package handler

// Ask answers the chat panel's questions, and Opener writes its first turn.
//
// This used to be a proxy to the corpus RAG. It is now the assistant itself: it calls the
// InsureNation plan-catalogue MCP service for facts, a model for words, and the CRM for the
// lead. The wire contract with the browser is unchanged, field for field, because the panel
// already reads it — `answer`, `citations`, `plans`, `escalate`, `reason`, `step`, `steps` on
// /v1/ask, and `greeting`/`question`/`disclosure`/`step`/`steps` on /v1/opener.
//
// Why the move: the RAG answered from prose chunks behind a confidence floor, so a plan question
// that scored a little under it came back as "a counsellor will confirm", and comparing two
// plans meant assembling two records out of retrieved paragraphs. The catalogue holds those
// records structured, and returns both in one call. The funnel moved with the answer, from a
// precedence chain that decided each turn before the model saw it to guidance the model reasons
// with — which is what lets an off-script question be answered without the sequence restarting.
//
// Keys live here and never cross to the browser. This is a Vite build, so anything in a VITE_*
// variable is compiled into the public bundle and is not a secret.

import (
	"context"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"imagine_backend/internal/assistant"
	"imagine_backend/internal/crm"
)

// A turn is up to four tool rounds and a possible retry, each one a completion. Well clear of
// that, and still under the server's own write timeout.
const askTimeout = 45 * time.Second

// Requests are small — a question plus a few turns of history. Anything larger is not a chat
// message, and reading it in full before rejecting would be the point of the exercise for
// whoever sent it.
const maxRequestBytes = 32 << 10

// The lead push outlives the request it was triggered by: it runs after the answer has been
// written, so a slow CRM cannot delay the visitor's reply. It gets its own budget for the same
// reason it gets its own context.
const reportTimeout = 25 * time.Second

// Built once, on first use, rather than at import: the process must be able to boot and serve
// the site even if the assistant's variables are missing. What it must not do is answer as
// though it had a knowledge base, which is what the unconfigured branch below is for.
var (
	agentOnce sync.Once
	agent     *assistant.Agent
	crmOnce   sync.Once
	crmClient *crm.Client
)

func chatAgent() *assistant.Agent {
	agentOnce.Do(func() {
		kb := assistant.NewMCP(os.Getenv("KB_API_URL"), os.Getenv("KB_API_KEY"))
		llm := assistant.NewLLM(os.Getenv("OPENAI_BASE_URL"), os.Getenv("OPENAI_API_KEY"),
			os.Getenv("ASSISTANT_MODEL"))
		agent = assistant.NewAgent(kb, llm)
	})
	return agent
}

func leads() *crm.Client {
	crmOnce.Do(func() { crmClient = crm.New() })
	return crmClient
}

func configured() bool {
	return os.Getenv("KB_API_URL") != "" && os.Getenv("KB_API_KEY") != "" &&
		os.Getenv("OPENAI_API_KEY") != ""
}

type askRequest struct {
	Q       string              `json:"q"`
	History []assistant.Message `json:"history,omitempty"`
	// Line is what the previous turn resolved to, echoed back. The transcript the client sends
	// is a window, and the visitor's one statement of which cover they want scrolls out of it.
	Line string `json:"line,omitempty"`
	// Asked is the funnel questions the client remembers being put, by key. Same reason as Line.
	Asked []string `json:"asked,omitempty"`
	// Consent is where the client believes the contact close has got to. Same echo pattern.
	Consent string `json:"consent,omitempty"`

	// Carried so the conversation can be reported to the CRM as a lead. All optional, and the
	// phone is the trigger: without one the CRM cannot resolve a lead, so nothing is reported.
	// SessionID groups the turns — it is not a token and grants nothing.
	SessionID string            `json:"session_id,omitempty"`
	Phone     string            `json:"phone,omitempty"`
	Name      string            `json:"name,omitempty"`
	Email     string            `json:"email,omitempty"`
	Data      map[string]string `json:"data,omitempty"`
}

// Ask handles POST /v1/ask.
func Ask(c *gin.Context) {
	if !configured() {
		// Unconfigured is an operator error, not a visitor's. Say so in the log and give the
		// visitor something they can act on rather than a bare 500.
		log.Printf("ask: unconfigured — KB_API_URL, KB_API_KEY and OPENAI_API_KEY are required")
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"answer":   "The assistant is not available right now. Please call +91 99101 69789.",
			"escalate": true,
		})
		return
	}

	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxRequestBytes)
	var req askRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if strings.TrimSpace(req.Q) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "q is required"})
		return
	}

	// Detached from the request context on purpose. gin cancels that when the response is
	// written, and the lead push runs after — see report().
	ctx, cancel := context.WithTimeout(context.WithoutCancel(c.Request.Context()), askTimeout)
	defer cancel()

	result := chatAgent().Answer(ctx, assistant.Request{
		Q:       req.Q,
		History: req.History,
		Line:    req.Line,
		Asked:   req.Asked,
		Phone:   req.Phone,
		Name:    req.Name,
		Consent: req.Consent,
		Product: req.Data["product"],
		Page:    req.Data["page"],
	})

	c.JSON(http.StatusOK, result)

	// After the answer is on the wire. A CRM outage can never delay or fail a reply.
	go report(req, result)
}

// openerRequest is the page context and nothing else. An opener is not a question anyone asked,
// so there is no q, no history and no contact detail to carry.
type openerRequest struct {
	Data map[string]string `json:"data,omitempty"`
}

// Opener handles POST /v1/opener: what the panel says when it opens.
//
// A visitor who opens the chat on /health-insurance is standing on that product's page, and
// asking them which cover they want reads as not having paid attention. The page context becomes
// that funnel's first question instead. Deterministic — no tool call, no completion — so unlike
// the orchestrator's old greeting this costs nothing per panel open, which is what retired that
// one. It therefore does not need the assistant to be configured, and answering it anyway means
// a misconfigured deploy still opens with the right question rather than a dead panel.
func Opener(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxRequestBytes)
	var req openerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	line := assistant.LineFromPage(req.Data["product"], req.Data["page"])
	c.JSON(http.StatusOK, assistant.Opener(line))
}

// report pushes the conversation to the CRM once a phone number exists.
//
// The phone is the trigger and the CRM cannot create a lead without one, so a conversation that
// never reaches the contact form is never reported — that is the expected state for most
// sessions, not a failure. From the turn the number arrives, every later turn pushes again with
// the whole transcript, because the CRM upserts on (org_id, session_id).
//
// A 200 is not success here. matched:false, or a matched:true with no lead_id, means the lead
// vanished, and it is logged as the failure it is.
func report(req askRequest, result assistant.Result) {
	defer func() {
		// A panic in reporting must not take the process down with it. The visitor already has
		// their answer.
		if r := recover(); r != nil {
			log.Printf("crm: recovered while reporting: %v", r)
		}
	}()

	client := leads()
	if !client.Enabled() || strings.TrimSpace(req.Phone) == "" {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), reportTimeout)
	defer cancel()

	res, err := client.Report(ctx, crm.Lead{
		Phone:      req.Phone,
		Name:       req.Name,
		Email:      req.Email,
		Line:       result.Line,
		Status:     leadStatus(result),
		Note:       leadNote(result),
		Data:       req.Data,
		Funnel:     funnelFlags(result),
		Consent:    consentOf(result, req),
		Transcript: transcript(req, result),
	})
	if err != nil {
		log.Printf("crm: report failed for session %q: %v", req.SessionID, err)
		return
	}
	log.Printf("crm: reported session %q as lead %s (created=%t)", req.SessionID, res.LeadID, res.Created)
}

// leadStatus uses the WhatsApp workflow's own vocabulary, so one org taxonomy covers both
// channels: a funnel that ran to the end is qualified, anything short of that is qualifying.
func leadStatus(result assistant.Result) string {
	if result.Reason == "shortlist" {
		return "qualified"
	}
	return "qualifying"
}

func leadNote(result assistant.Result) string {
	note := "InsureNation website chat"
	if result.Line != "" {
		note += " — " + result.Line
	}
	if result.Steps > 0 {
		note += ", qualification " + strconv.Itoa(result.Step) + "/" + strconv.Itoa(result.Steps)
	}
	if result.Escalate {
		note += ", escalated to a counsellor"
	}
	return note
}

// funnelFlags mirrors the RAG's funnel_for: the desk reads these, and only the Dograh
// vocabulary is sent. The seven legacy web-agency short keys are deliberately not.
func funnelFlags(result assistant.Result) map[string]bool {
	flags := map[string]bool{"contact_captured": true}
	switch result.Reason {
	case "funnel", "shortlist":
		flags["qualified"] = true
	}
	if result.Reason == "shortlist" {
		flags["callback_requested"] = true
	}
	return flags
}

// transcript is the conversation as the CRM stores it, built from the history the client sent
// plus the turn just answered. There is no server-side buffer to read it from and none is
// wanted: the request carries the conversation, so any replica can report any turn.
func transcript(req askRequest, result assistant.Result) *crm.Transcript {
	if req.SessionID == "" {
		return nil
	}
	now := time.Now().UTC().Format(time.RFC3339)
	turns := make([]crm.Turn, 0, len(req.History)+2)
	for _, m := range req.History {
		if m.Role != "user" && m.Role != "assistant" {
			continue
		}
		if strings.TrimSpace(m.Content) == "" {
			continue
		}
		turns = append(turns, crm.Turn{Role: m.Role, Text: m.Content, At: now})
	}
	turns = append(turns,
		crm.Turn{Role: "user", Text: req.Q, At: now},
		crm.Turn{Role: "assistant", Text: result.Answer, At: now},
	)
	return &crm.Transcript{SessionID: req.SessionID, StartedAt: now, Turns: turns}
}

// consentOf turns the turn's recorded permission into the CRM's record.
//
// The consent text is taken from the constant the visitor was shown, not from anything in the
// reply: the record has to say what they were actually asked, and an answer paraphrased back at
// them is not that. The page is carried because a permission belongs to the page it was given on.
func consentOf(result assistant.Result, req askRequest) *crm.Consent {
	if result.Record == nil {
		return nil
	}
	return &crm.Consent{
		Channel:     "whatsapp",
		Status:      result.Record.Status,
		ConsentText: assistant.WhatsAppQuestion,
		OptionTitle: result.Record.OptionTitle,
		PageURL:     req.Data["page"],
	}
}
