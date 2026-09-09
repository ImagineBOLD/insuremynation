package assistant

// The assistant: one model, seven MCP tools, and the funnel as guidance.
//
// This replaces a proxy to the corpus RAG, and the shape of the replacement is the fix. The RAG
// answered from prose chunks behind a confidence floor, so a plan question that scored a little
// under the floor came back as "a counsellor will confirm" — and its funnel was a precedence
// chain that decided each turn before the model saw it, so an off-script question either got
// consumed as a funnel answer or sent the sequence back to the start. Here the model sees the
// whole turn: the question asked, what has already been answered, and structured plan records
// it fetched itself.
//
// The response body is unchanged from the RAG's, field for field, because the panel already
// reads it: `answer`, `citations`, `plans`, `escalate`, `reason`, `step`, `steps`. `reason` and
// `escalate` are what decide when the contact form appears, which is what decides whether a
// lead is ever created — see useHeadlessChat.js's askContact gate.

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
)

// Tool rounds per turn. A comparison is one lookup; a comparison where the model has to search
// for both slugs first is three. Four leaves room for a recovery from a bad slug and still ends
// well inside the handler's own deadline.
const maxToolRounds = 4

// Turns of history sent back to the model — enough for "and what about my wife?", short enough
// to bill. Each message is trimmed, because one pasted policy wording should not crowd out the
// conversation.
const (
	maxHistoryTurns = 6
	maxHistoryChars = 2000
)

// What a visitor reads when we will not answer. The tool responses carry steering written for a
// model ("never invent details"); returning one to a customer shows them our stage directions,
// which is exactly what happened the first time the RAG ran live.
const (
	escalationText = "I want to get this exactly right, and I don't have it in writing here. " +
		"Let me have one of our specialists call you — they'll be able to answer properly. " +
		"You can also reach us on +91 99101 69789."

	uncoveredText = "We don't place %s policies, so I don't have their documents to quote from " +
		"and I'd rather not guess. I can tell you about the insurers we do work with, or have a " +
		"specialist call you on +91 99101 69789."

	withheldText = "That comes down to figures I'd rather a specialist confirm for you — they " +
		"move, and they depend on your policy. I can have someone call you to go through it. " +
		"Our number is +91 99101 69789."

	degradedText = "I'm having trouble reaching our plan records right now. I can have a " +
		"specialist call you, or you can reach us on +91 99101 69789."
)

// Asked once more before giving up. The guard is a guarantee, but replacing a mostly-good answer
// with boilerplate because one clause strayed is a bad trade for the visitor — the RAG's first
// live run lost a perfectly good "yes, cataract is covered, with limits" that way.
//
// Phrasing matters more than usual here. An earlier draft of this asked the model to "say how
// long any qualifying period runs", which invited it to name the duration again — and it did, so
// the retry failed for the reason the retry existed. Ask for the shape of the answer, not the
// figure. "Qualifying period" rather than "waiting period" is also deliberate: the guard treats
// the phrase itself as a trip, so telling the model to use it would guarantee a second failure.
const retryNote = "Rewrite your previous answer. Keep everything you said about what the policy " +
	"covers. Where you gave a length of time or an amount of money, say instead that a qualifying " +
	"period applies and one of our specialists will confirm the details for the customer's own " +
	"policy. Use no numbers for time or money. Keep it under 600 characters."

// Request is one turn from the panel.
type Request struct {
	Q       string
	History []Message
	// Line is the line the previous turn resolved to, echoed back by the client. See
	// ActiveLine: the transcript is a window and the visitor's statement of intent scrolls out
	// of it.
	Line string
	// Asked is the funnel question keys the client reports as already put to the visitor. Same
	// reason as Line: the transcript is a window and the early questions slide out of it.
	Asked []string
	// Phone and Name arrive on the turn the contact form is submitted, and drive the messaging
	// permission turn that follows it.
	Phone string
	Name  string
	// Consent is where the client believes the contact close has got to.
	Consent string
	Product string
	Page    string
}

// Citation names one insurer document behind an answer. Field names are the panel's, not the
// catalogue's: citationLabel() reads `insurer` as a slug and `doc_title` as a document name.
// The catalogue's documents carry a kind and a URL but no title, so the name is composed from
// the plan and the kind — "Care Supreme Brochure". `source_url` travels and is deliberately not
// rendered: we are a broker, and a link to the insurer's own PDF under our own answer is an exit
// to a company the visitor can then buy from directly.
type Citation struct {
	Insurer   string `json:"insurer"`
	DocTitle  string `json:"doc_title"`
	DocID     string `json:"doc_id"`
	SourceURL string `json:"source_url,omitempty"`
}

// Plan is one card under the bubble. PlanCards renders plan_name, then "insurer · plan_type".
type Plan struct {
	PlanName string `json:"plan_name"`
	Insurer  string `json:"insurer"`
	PlanType string `json:"plan_type,omitempty"`
	PlanSlug string `json:"plan_slug,omitempty"`
}

// Result is the response body, shaped for askResponse.js.
type Result struct {
	Question  string     `json:"question"`
	Answer    string     `json:"answer"`
	Citations []Citation `json:"citations"`
	Plans     []Plan     `json:"plans"`
	Escalate  bool       `json:"escalate"`
	Reason    string     `json:"reason,omitempty"`
	Step      int        `json:"step,omitempty"`
	Steps     int        `json:"steps,omitempty"`
	Retried   bool       `json:"retried,omitempty"`
	Withheld  []string   `json:"withheld,omitempty"`
	Degraded  bool       `json:"degraded,omitempty"`

	// Line is the cover line this turn was answered on. The handler uses it to pick the CRM lead
	// category, and the client echoes it back on the next request so the funnel cannot lose its
	// place when the transcript window slides past the visitor's statement of intent.
	Line string `json:"line,omitempty"`
	// Asked is the funnel questions already put, by key, echoed back by the client next turn.
	Asked []string `json:"asked,omitempty"`

	// Consent is where the contact close has got to: "" (not started), "asked", "granted" or
	// "denied". Echoed back by the client next turn, for the same reason `line` and `asked` are.
	Consent string `json:"consent,omitempty"`
	// Record is the permission this turn captured, if it captured one. Not read by the panel; the
	// handler forwards it to the CRM, whose send gate is the thing that needs it.
	Record *ConsentRecord `json:"-"`
}

// Agent answers turns. One per process.
type Agent struct {
	mcp   *MCP
	model *LLM
}

// NewAgent wires an agent to its knowledge base and its model.
func NewAgent(mcp *MCP, model *LLM) *Agent {
	return &Agent{mcp: mcp, model: model}
}

// Answer runs one turn.
func (a *Agent) Answer(ctx context.Context, req Request) Result {
	line := ActiveLine(req.History, req.Q, req.Line, req.Product, req.Page)
	// Everything below derives the funnel position from this copy, never from req.History: it
	// carries the questions the client remembers being asked, which the window may have dropped.
	// The model still gets the real transcript.
	fh := FoldAsked(req.History, line, req.Asked)
	step, steps := Progress(line, fh)
	base := Result{
		Question:  req.Q,
		Citations: []Citation{},
		Plans:     []Plan{},
		Line:      line,
		Step:      step,
		Steps:     steps,
	}
	base.Asked = AskedKeys(line, fh)
	base.Reason = reasonFor(line, fh)

	// The contact close, and the two turns that stay a gate rather than becoming guidance. A
	// messaging permission is not something a model may phrase for itself: the record has to
	// carry the exact words the visitor was shown. Neither turn calls the model or a tool.
	//
	// Where the close has got to, echoed by the client and cross-checked against the transcript.
	// It is tracked rather than inferred from "did this turn carry a phone" because the client
	// re-sends the contact details on every turn after the form — so that test was true forever
	// and the permission question asked itself on every subsequent turn, which a visitor saw.
	// And it cannot be inferred from the transcript alone either: that is a window, and the
	// question scrolls out of it exactly like the funnel questions did.
	consent := req.Consent
	if consent == "" && ConsentAsked(req.History) {
		consent = consentAsked
	}
	base.Consent = consent

	// No contact details, no close — whatever the client claims about consent. There is no
	// permission to ask for before a number exists, and this guard is what stops a stale
	// `consent` from a previous conversation greeting a new visitor with the sign-off on their
	// first message. That shipped, and a visitor saw it: the client persists this state to
	// survive the transcript window, so it also survives a transcript being thrown away.
	//
	// Belt and braces with the client clearing it on reset. This half is the one that holds when
	// the state arrives from a browser doing something neither of us predicted.
	hasContact := strings.TrimSpace(req.Phone) != ""
	if !hasContact {
		base.Consent = ""
		consent = ""
	}

	// Read before ask: once the question has gone out, the next turn is the answer to it.
	if hasContact && (consent == consentAsked || AwaitingWhatsApp(req.History)) {
		status := ReadConsent(req.Q)
		base.Answer = ContactAck(req.Name, status)
		base.Reason = "contact"
		base.Consent = status
		base.Record = &ConsentRecord{
			Status: status,
			// The chip they tapped, or whatever they typed instead.
			OptionTitle: strings.TrimSpace(req.Q),
		}
		return base
	}
	if hasContact && consent == "" {
		base.Answer = WhatsAppAsk(req.Name)
		base.Reason = "contact"
		base.Consent = consentAsked
		return base
	}

	// Before anything is spent. An insurer we do not place is a closed-list name check, and
	// answering for one with another company's plan is the worst failure this system can
	// produce: confident, well-sourced, and about the wrong company.
	if who := UncoveredInsurer(req.Q); who != "" {
		base.Answer = fmt.Sprintf(uncoveredText, who)
		base.Escalate = true
		base.Reason = "coverage"
		return base
	}

	tools, err := a.mcp.Tools(ctx)
	if err != nil {
		// The knowledge base is the whole answer here, so this is not a degraded answer, it is
		// no answer. Say so and offer the callback rather than letting the model improvise from
		// memory, which is the one thing the plan-facts policy forbids.
		log.Printf("assistant: tools unavailable: %v", err)
		base.Answer = degradedText
		base.Escalate = true
		base.Degraded = true
		return base
	}

	turns := []llmMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "system", Content: funnelGuidance(line, fh)},
	}
	turns = append(turns, historyMessages(req.History)...)
	turns = append(turns, llmMessage{Role: "user", Content: req.Q})

	text, seen, err := a.run(ctx, turns, tools)
	if err != nil {
		log.Printf("assistant: %v", err)
		base.Answer = escalationText
		base.Escalate = true
		base.Degraded = true
		return base
	}

	base.Plans, base.Citations = harvest(seen)

	offered := OfferedOptions(line, fh)
	// After Cap, never before: the choices are the tappable half of the turn and must not be the
	// part that gets truncated away.
	answer := withOptions(Cap(Tidy(text, offered)), line, fh, offered)
	if answer == "" {
		base.Answer = escalationText
		base.Escalate = true
		return base
	}

	if leaked := Leaked(answer); len(leaked) > 0 {
		retried, rerr := a.retry(ctx, turns, answer)
		switch {
		case rerr == nil && len(Leaked(retried)) == 0:
			base.Answer = Cap(Tidy(retried, offered))
			base.Retried = true
		default:
			if rerr != nil {
				log.Printf("assistant: retry after %v: %v", leaked, rerr)
			}
			base.Answer = withheldText
			base.Withheld = leaked
		}
		return base
	}

	base.Answer = answer
	return base
}

// reasonFor is what the panel keys the contact form off. "funnel" vetoes the form — a visitor
// three questions deep should not be interrupted by it — and "shortlist" invites it, because by
// then the assistant has named plans and earned the number.
func reasonFor(line string, history []Message) string {
	if line == "" {
		return "router"
	}
	if len(Remaining(line, history)) == 0 {
		return "shortlist"
	}
	return "funnel"
}

// run is the tool loop.
func (a *Agent) run(ctx context.Context, turns []llmMessage, tools []Tool) (string, []string, error) {
	specs := make([]llmTool, 0, len(tools))
	for _, t := range tools {
		specs = append(specs, llmTool{
			Type: "function",
			Function: llmFunction{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  t.InputSchema,
			},
		})
	}

	var seen []string
	for round := 0; round < maxToolRounds; round++ {
		reply, err := a.model.Complete(ctx, turns, specs, 0.2)
		if err != nil {
			return "", seen, err
		}
		if len(reply.ToolCalls) == 0 {
			return reply.Content, seen, nil
		}
		turns = append(turns, llmMessage{
			Role:      "assistant",
			Content:   reply.Content,
			ToolCalls: reply.ToolCalls,
		})
		for _, tc := range reply.ToolCalls {
			out := a.callTool(ctx, tc)
			seen = append(seen, out)
			turns = append(turns, llmMessage{
				Role:       "tool",
				ToolCallID: tc.ID,
				Content:    out,
			})
		}
	}
	// Out of rounds with tool calls still coming. One more pass with the tools withheld, so the
	// visitor gets the answer the model already has the records for rather than nothing.
	reply, err := a.model.Complete(ctx, turns, nil, 0.2)
	if err != nil {
		return "", seen, err
	}
	return reply.Content, seen, nil
}

// callTool runs one requested tool and returns text for the model to read.
//
// A failure comes back as text rather than an error, deliberately. The catalogue already reports
// its own misses that way and the model handles them well — a transport failure phrased in the
// same register lets it say we could not check rather than abandoning the turn.
func (a *Agent) callTool(ctx context.Context, tc llmToolCall) string {
	var args map[string]any
	if raw := strings.TrimSpace(tc.Function.Arguments); raw != "" && raw != "null" {
		if err := json.Unmarshal([]byte(raw), &args); err != nil {
			return `{"error": "those arguments were not valid JSON; call the tool again"}`
		}
	}
	// One line per lookup. This is the operational signal worth having: whether a comparison
	// used a single plan_slug call or fell back to searching twice is the difference between the
	// shape this change exists to produce and the shape it replaced. The arguments are written
	// by the model — plan slugs and short search terms — not the visitor's own text.
	log.Printf("assistant: tool %s %s", tc.Function.Name, strings.TrimSpace(tc.Function.Arguments))

	out, err := a.mcp.CallTool(ctx, tc.Function.Name, args)
	if err != nil {
		log.Printf("assistant: tool %s: %v", tc.Function.Name, err)
		return `{"error": "the knowledge base could not be reached for this lookup; tell the ` +
			`customer a specialist will confirm, and do not answer from memory"}`
	}
	return out
}

// retry asks once more at temperature 0.
func (a *Agent) retry(ctx context.Context, turns []llmMessage, previous string) (string, error) {
	turns = append(append([]llmMessage{}, turns...),
		llmMessage{Role: "assistant", Content: previous},
		llmMessage{Role: "user", Content: retryNote},
	)
	reply, err := a.model.Complete(ctx, turns, nil, 0)
	if err != nil {
		return "", err
	}
	return reply.Content, nil
}

func historyMessages(history []Message) []llmMessage {
	if n := maxHistoryTurns * 2; len(history) > n {
		history = history[len(history)-n:]
	}
	out := make([]llmMessage, 0, len(history))
	for _, m := range history {
		if m.Role != "user" && m.Role != "assistant" {
			continue
		}
		content := m.Content
		if len(content) > maxHistoryChars {
			content = content[:maxHistoryChars]
		}
		if strings.TrimSpace(content) == "" {
			continue
		}
		out = append(out, llmMessage{Role: m.Role, Content: content})
	}
	return out
}

// catalogueReply is the part of a tool response this service reads. Everything else is for the
// model. Both list and compare shapes carry `plans`; an exact match carries `plan`.
type catalogueReply struct {
	Match string          `json:"match"`
	Plan  *cataloguePlan  `json:"plan"`
	Plans []cataloguePlan `json:"plans"`
}

type cataloguePlan struct {
	Insurer     string `json:"insurer"`
	InsurerSlug string `json:"insurer_slug"`
	PlanName    string `json:"plan_name"`
	PlanSlug    string `json:"plan_slug"`
	PlanType    string `json:"plan_type"`
	Documents   []struct {
		Kind string `json:"kind"`
		URL  string `json:"url"`
	} `json:"documents"`
}

// Maximum cards and citation lines under one bubble. Four citations at 11px is already the most
// a bubble can carry without becoming a wall of document names, and three plans is the
// shortlist shape the workflow specifies.
const (
	maxPlanCards = 3
	maxCitations = 4
)

// harvest pulls cards and citations out of the tool responses this turn produced.
//
// Read from the tool output rather than from the answer text on purpose: a card for a plan the
// model merely mentioned would be a card for a plan nothing returned, which is the invention
// the plan-facts policy exists to prevent. If it is on screen, a tool returned it.
func harvest(seen []string) ([]Plan, []Citation) {
	plans := []Plan{}
	cites := []Citation{}
	planSeen := map[string]bool{}
	citeSeen := map[string]bool{}
	// Documents grouped by the plan they came from, so citations can be spread across plans
	// rather than filled from the first one.
	var perPlan [][]Citation

	for _, raw := range seen {
		var reply catalogueReply
		if err := json.Unmarshal([]byte(raw), &reply); err != nil {
			continue
		}
		records := reply.Plans
		if reply.Plan != nil {
			records = append([]cataloguePlan{*reply.Plan}, records...)
		}
		// A search that returned forty summaries is not a shortlist, and turning one into forty
		// cards would bury the answer. Only a narrowed result earns cards.
		if reply.Match == "list" && len(records) > maxPlanCards {
			continue
		}
		for _, r := range records {
			if r.PlanName == "" || planSeen[r.PlanSlug] {
				continue
			}
			planSeen[r.PlanSlug] = true
			if len(plans) < maxPlanCards {
				plans = append(plans, Plan{
					PlanName: r.PlanName,
					Insurer:  r.Insurer,
					PlanType: r.PlanType,
					PlanSlug: r.PlanSlug,
				})
			}
			var docs []Citation
			for _, d := range r.Documents {
				// Deduped by the label the panel actually prints, not only by URL: a plan can
				// carry two brochures at different URLs, and two identical lines under one
				// bubble read as a bug.
				label := docTitle(r.PlanName, d.Kind)
				if d.URL == "" || citeSeen[d.URL] || citeSeen[label] {
					continue
				}
				citeSeen[d.URL] = true
				citeSeen[label] = true
				docs = append(docs, Citation{
					Insurer:   r.InsurerSlug,
					DocTitle:  label,
					DocID:     r.PlanSlug + "-" + d.Kind,
					SourceURL: d.URL,
				})
			}
			perPlan = append(perPlan, docs)
		}
	}
	return plans, append(cites, spread(perPlan)...)
}

// spread takes one document from each plan before taking a second from any, so a comparison of
// two plans does not cite four documents from the first and none from the second. Care Supreme
// alone carries four, which is the whole allowance.
func spread(perPlan [][]Citation) []Citation {
	var out []Citation
	for depth := 0; len(out) < maxCitations; depth++ {
		added := false
		for _, docs := range perPlan {
			if depth >= len(docs) || len(out) >= maxCitations {
				continue
			}
			out = append(out, docs[depth])
			added = true
		}
		if !added {
			break
		}
	}
	return out
}

// docKinds are the catalogue's document kinds as a visitor would read them. "other" is the
// commonest kind in the data and is usually the policy terms, but it is not reliably that, so
// it becomes the neutral word rather than a claim about what the document is.
var docKinds = map[string]string{
	"brochure":       "Brochure",
	"prospectus":     "Prospectus",
	"policy_wording": "Policy Wording",
	"other":          "Policy Document",
}

func docTitle(plan, kind string) string {
	label := docKinds[kind]
	if label == "" {
		label = "Document"
	}
	if plan == "" {
		return label
	}
	return plan + " " + label
}

// withOptions re-attaches the current funnel question's choices when the model asked that
// question and left them out.
//
// The prompt asks for them every turn and mostly gets them, but "mostly" is the wrong standard
// for the tappable half of a turn: on a phone the difference between chips and no chips is
// whether the visitor types their answer or picks it, and a funnel is abandoned at the keyboard.
// The observed failure is specific — the model answers an off-script question, re-asks the funnel
// question correctly, and drops the list. So this only fires when the question it was told to ask
// is actually in the reply and no option run survived Tidy; it never invents a menu for a turn
// that did not ask for one.
func withOptions(answer, line string, history []Message, offered []string) string {
	if answer == "" || len(offered) == 0 {
		return answer
	}
	remaining := Remaining(line, history)
	if len(remaining) == 0 {
		return answer
	}
	if !strings.Contains(strings.ToLower(answer), prefixKey(remaining[0].Text)) {
		return answer
	}
	if from, _ := menuRun(strings.Split(answer, "\n"), offered); from != -1 {
		return answer
	}
	var b strings.Builder
	b.WriteString(answer)
	for _, o := range offered {
		b.WriteString("\n- ")
		b.WriteString(o)
	}
	return b.String()
}

// ConsentRecord is a messaging permission as the CRM records it.
//
// `consent_text` is the load-bearing field and it is filled in by the caller from the constant
// the visitor was actually shown, not from anything the model wrote: "they agreed" is not a
// record, the question they were asked is.
type ConsentRecord struct {
	Status      string // "granted" | "denied" — a refusal is denied, never an omission
	OptionTitle string
}

// consentAsked marks the close as waiting for an answer. The other two states a conversation can
// be in are the CRM's own vocabulary, so they need no constant here.
const consentAsked = "asked"
