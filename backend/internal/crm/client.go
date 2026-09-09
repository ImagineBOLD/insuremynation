package crm

// Client for the Imagine CRM's lead-status webhook.
//
// Ported from the corpus RAG's crm/client.py, which is where this integration was learned. Its
// docstring named three things that drive the shape of the code, and all three still hold:
//
// A 200 proves nothing. An unresolvable payload — no phone, an unparseable number, a lead_id
// belonging to another organization — still returns 200, with "matched": false and no lead_id
// (CRM internal/webhook/leadstatus.go, whenever resolveOrCreateLead cannot resolve one).
// Asserting on the status code would let a completely dead integration look healthy
// indefinitely. Report therefore treats matched:false or a missing lead_id as a failure and logs
// the identity that caused it. That lesson has been paid for once already: an unrecognised
// Dograh funnel flag was silently ignored and the lead vanished while every screen said success.
//
// The key is the organization. A per-org X-API-Key scopes every lookup and write to that org,
// so no org_id ever goes in a body. The platform-wide key would also authenticate, but it
// carries no org and lets the caller read or write any tenant — never ship it. Note that the
// WhatsApp workflow's own webhook template does send an org_id, which means that channel is
// using the platform key; do not copy it.
//
// This must never break an answer. A reporting failure is logged and swallowed. A customer
// asking about cataract cover does not care that the CRM is down, and must not be made to.

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

const defaultBase = "https://crm-staging-11a5.up.railway.app"

// The CRM caps its own read at a body size of this order; past it the request is rejected whole,
// which would lose the funnel flags along with the transcript. Shedding beats rejection.
const maxBody = 64 << 10

// Long enough for a cold Railway service, short enough that a hung CRM cannot pin a goroutine
// for the life of the process.
const timeout = 20 * time.Second

// A note is a one-line summary on the lead's timeline, not a transcript.
const maxNote = 500

// Each turn is capped so one pasted policy wording cannot crowd out the conversation, matching
// the RAG's buffer.
const maxTurnChars = 2000

// Turn is one message in the reported transcript.
type Turn struct {
	Role string `json:"role"` // "user" | "assistant"
	Text string `json:"text"`
	At   string `json:"at"`
}

// Transcript is the website-chat rail on the CRM lead page. The CRM upserts on
// (org_id, session_id), so re-sending the whole thing on every later turn is correct and is how
// the rail stays complete.
type Transcript struct {
	SessionID string `json:"session_id"`
	StartedAt string `json:"started_at"`
	Turns     []Turn `json:"turns"`
}

// Lead is one report.
type Lead struct {
	Phone      string
	Name       string
	Email      string
	Line       string
	Status     string
	Note       string
	Data       map[string]string
	Funnel     map[string]bool
	Consent    *Consent
	Transcript *Transcript
}

// Client posts lead reports. One per process; safe for concurrent use.
type Client struct {
	base      string
	key       string
	leadTypes map[string]string
	hc        *http.Client
}

// New reads the environment and returns a client. A missing CRM_API_KEY disables reporting
// rather than failing: the chat still answers, and Enabled() says why nothing arrives.
func New() *Client {
	base := strings.TrimRight(os.Getenv("CRM_BASE_URL"), "/")
	if base == "" {
		base = defaultBase
	}

	// CRM_LEAD_TYPES maps our cover line to the org's own lead-category key. It is per-org
	// vocabulary, so it cannot be hardcoded: the CRM ships a web-agency taxonomy where
	// "travel_website" means a travel *website* client, not travel insurance. A key the org does
	// not have is accepted by the API, matches no team member, and leaves the lead queued
	// forever with nothing reporting an error — so bad JSON here disables the field rather than
	// guessing at it.
	leadTypes := map[string]string{}
	if raw := strings.TrimSpace(os.Getenv("CRM_LEAD_TYPES")); raw != "" {
		if err := json.Unmarshal([]byte(raw), &leadTypes); err != nil {
			log.Printf("crm: CRM_LEAD_TYPES is not valid JSON, lead_type will not be sent: %v", err)
			leadTypes = map[string]string{}
		}
	}

	return &Client{
		base:      base,
		key:       os.Getenv("CRM_API_KEY"),
		leadTypes: leadTypes,
		hc:        &http.Client{Timeout: timeout},
	}
}

// Enabled is whether a key is configured. Without one nothing is reported at all.
func (c *Client) Enabled() bool { return c != nil && c.key != "" }

type payload struct {
	Phone      string            `json:"phone,omitempty"`
	Name       string            `json:"name,omitempty"`
	Email      string            `json:"email,omitempty"`
	Status     string            `json:"status,omitempty"`
	Note       string            `json:"note,omitempty"`
	LeadType   *string           `json:"lead_type,omitempty"`
	Funnel     map[string]bool   `json:"funnel,omitempty"`
	Data       map[string]string `json:"data,omitempty"`
	Consent    *Consent          `json:"consent,omitempty"`
	Transcript *Transcript       `json:"transcript,omitempty"`
}

// Result is what came back, once matched:false has been read for what it is.
type Result struct {
	OK      bool
	LeadID  string
	Created bool
}

// Report pushes one lead. It never returns an error the caller is expected to surface to a
// visitor; the error is for the log.
//
// Sentiment is deliberately not sent. The RAG spent a second model call per conversation to
// label it, and nothing here reads it.
//
// Consent is sent, and it is sent exactly once — on the turn the visitor answers the messaging
// permission question, which is the only turn that answer exists on. The RAG kept a `consent_sent`
// flag in a session store and retried until the CRM accepted it; this service holds no state, so
// there is no retry.
//
// ponytail: one attempt. If that single push fails the funnel flags still land on later turns but
// the permission does not, and the lead is one nobody may message. The log line is the only
// signal, so it names the session. Upgrade path if that ever bites: have the client echo a
// consent-pending flag the way it echoes `line` and `asked`, and re-send until a push succeeds.
func (c *Client) Report(ctx context.Context, lead Lead) (Result, error) {
	if !c.Enabled() {
		return Result{}, fmt.Errorf("crm: CRM_API_KEY is not set")
	}
	// The CRM would answer 200/matched:false. Say so here rather than spending a request to be
	// told.
	if strings.TrimSpace(lead.Phone) == "" {
		return Result{}, fmt.Errorf("crm: no phone, so the CRM cannot resolve a lead")
	}

	body := payload{
		Phone:      strings.TrimSpace(lead.Phone),
		Name:       strings.TrimSpace(lead.Name),
		Email:      strings.TrimSpace(lead.Email),
		Status:     strings.TrimSpace(lead.Status),
		Note:       truncate(strings.TrimSpace(lead.Note), maxNote),
		Data:       nonEmpty(lead.Data),
		Funnel:     truthy(lead.Funnel),
		Consent:    validConsent(lead.Consent),
		Transcript: capTurns(lead.Transcript),
	}
	if key := c.leadTypes[lead.Line]; key != "" {
		body.LeadType = &key
	}

	encoded, err := shed(body)
	if err != nil {
		return Result{}, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.base+"/api/v1/webhooks/lead-status", bytes.NewReader(encoded))
	if err != nil {
		return Result{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	// The key is the tenant. No org_id travels in the body.
	req.Header.Set("X-API-Key", c.key)

	resp, err := c.hc.Do(req)
	if err != nil {
		return Result{}, fmt.Errorf("crm: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return Result{}, fmt.Errorf("crm: reading reply: %w", err)
	}
	if resp.StatusCode == http.StatusUnauthorized {
		return Result{}, fmt.Errorf("crm: 401 — CRM_API_KEY is wrong, or it is the platform key " +
			"rather than the org key")
	}
	if resp.StatusCode != http.StatusOK {
		return Result{}, fmt.Errorf("crm: http %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}

	var out struct {
		Matched bool   `json:"matched"`
		Created bool   `json:"created"`
		LeadID  string `json:"lead_id"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return Result{}, fmt.Errorf("crm: 200 with a body that is not JSON: %s",
			strings.TrimSpace(string(raw)))
	}
	// The failure that looks like success. A matched:true with no lead_id counts too — there is
	// nothing to attach the next turn to. Log the identity, not the whole body, which carries
	// customer data.
	if !out.Matched || out.LeadID == "" {
		return Result{}, fmt.Errorf("crm: NOT MATCHED (http 200): phone=%q response=%s",
			body.Phone, strings.TrimSpace(string(raw)))
	}
	return Result{OK: true, LeadID: out.LeadID, Created: out.Created}, nil
}

// shed encodes the payload, dropping the expendable fields in a fixed order until it fits.
//
// Order matters and is the RAG's: captured fields first, then the transcript. Identity and the
// funnel flags are never shed — they are the lead. The transcript is context for the human who
// calls; losing it costs the rail on the lead page, not the lead.
func shed(body payload) ([]byte, error) {
	for attempt := 0; attempt < 3; attempt++ {
		encoded, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		if len(encoded) <= maxBody {
			return encoded, nil
		}
		switch attempt {
		case 0:
			body.Data = nil
		case 1:
			body.Transcript = nil
		default:
			return encoded, nil
		}
	}
	return json.Marshal(body)
}

// truthy keeps only the flags that are set.
//
// A false is never sent: the CRM merges a funnel update rather than replacing it, so sending
// false does not un-set a stage — it is either ignored or, for a stage the org does not know,
// silently dropped along with whatever else shared the request.
func truthy(in map[string]bool) map[string]bool {
	if len(in) == 0 {
		return nil
	}
	out := map[string]bool{}
	for k, v := range in {
		if v {
			out[k] = true
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func nonEmpty(in map[string]string) map[string]string {
	if len(in) == 0 {
		return nil
	}
	out := map[string]string{}
	for k, v := range in {
		if strings.TrimSpace(v) != "" {
			out[k] = v
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func capTurns(t *Transcript) *Transcript {
	if t == nil || len(t.Turns) == 0 {
		return nil
	}
	out := *t
	out.Turns = make([]Turn, 0, len(t.Turns))
	for _, turn := range t.Turns {
		turn.Text = truncate(turn.Text, maxTurnChars)
		out.Turns = append(out.Turns, turn)
	}
	return &out
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// Consent is a messaging permission, and deliberately not a `data` field.
//
// A custom field is a note about the lead; consent is the lawful basis for messaging them, and
// the CRM keeps it in an append-only record that its send gate reads. Put in `data` it is
// invisible to that gate, which means nobody may WhatsApp the lead and nothing says why.
//
// ConsentText is the load-bearing part: "they agreed" is not a record — the question they were
// actually shown is. Status must be exactly "granted" or "denied" (the CRM's own vocabulary);
// anything else 400s the whole request, taking the funnel update down with it, so it is dropped
// here instead.
type Consent struct {
	Channel     string `json:"channel"`
	Status      string `json:"status"`
	ConsentText string `json:"consent_text,omitempty"`
	OptionTitle string `json:"option_title,omitempty"`
	PageURL     string `json:"page_url,omitempty"`
}

func validConsent(c *Consent) *Consent {
	if c == nil || (c.Status != "granted" && c.Status != "denied") {
		return nil
	}
	out := *c
	if out.Channel == "" {
		out.Channel = "whatsapp"
	}
	out.ConsentText = truncate(out.ConsentText, 500)
	out.OptionTitle = truncate(out.OptionTitle, 500)
	out.PageURL = truncate(out.PageURL, 500)
	return &out
}
