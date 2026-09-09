package assistant

// The qualification funnel: six questions per cover line, lifted verbatim from the Dograh voice
// workflow's F1-F6 nodes so the website, the phone and WhatsApp ask the same things in the same
// words. Ported from the corpus RAG's flow.py, which lifted them first.
//
// What changed in the port is not the questions, it is who is in charge. In the RAG this was a
// gate: an ordered precedence chain ran before retrieval and decided the turn, so a visitor who
// asked something off-script mid-funnel either had their question consumed as a funnel answer or
// pushed the funnel back to the start. Here the remaining questions are computed and handed to
// the model as guidance. The model answers what was asked and then re-asks the same question,
// which is what the workflow's own global prompt has always instructed and what a precedence
// chain structurally cannot express.
//
// Still stateless, and for the reason flow.py gives: the transcript the client sends *is* the
// state, so a restart, a second replica or a visitor with two tabs cannot corrupt a conversation
// that was never held server-side.

import (
	"regexp"
	"strings"
)

// Six is where the voice funnels sit ("keep it brisk"). Marine asks ten on the phone, where a
// caller will sit through them; in a chat window that is where people leave.
const maxQuestions = 6

// Question is one funnel turn. Empty Options is an open question — the workflow marks those
// "THIS QUESTION HAS NO CHOICE LIST", and they are the ones where a menu would be wrong.
type Question struct {
	Key     string
	Text    string
	Options []string
}

// Funnels holds our six customer-facing lines. Hardcoded rather than read from the workflow
// JSON: that file is a hand-exported artifact at the workspace root, not something this service
// image contains.
var Funnels = map[string][]Question{
	"health": {
		{"members", "Who would the cover be for?", []string{
			"Just me", "Me and my spouse", "Family floater - me, spouse and kids",
			"My parents", "Family including my parents"}},
		{"eldest_age", "And the age of the eldest person to be covered?", []string{
			"18 to 35", "36 to 50", "51 to 60", "Over 60"}},
		{"pre_existing", "Does anyone being covered have an existing medical condition? " +
			"It helps us shortlist insurers who will accept the case.", []string{
			"No, none", "Diabetes, blood pressure, thyroid or asthma",
			"A heart condition or a past surgery", "Something else", "Prefer not to say"}},
		{"sum_insured", "How much cover do you have in mind?", []string{
			"Up to 5 lakh", "5 to 10 lakh", "10 to 25 lakh", "25 lakh or more", "Not sure yet"}},
		{"city", "Which city are you in?", nil},
		{"current_policy_status", "Last one - do you have a health policy right now?", []string{
			"Yes, and I want to switch or add to it", "It has expired", "No, this is my first"}},
	},
	"life": {
		{"plan_type", "What is your main goal?", []string{
			"Protect my family if something happens to me", "Save and grow money",
			"A retirement income", "Not sure - I want advice"}},
		{"age", "How old are you?", []string{"18 to 30", "31 to 40", "41 to 50", "Over 50"}},
		{"tobacco", "Do you smoke or use tobacco in any form?", []string{"No", "Yes"}},
		{"income_slab", "What is your annual income? It drives the maximum cover you are eligible for.",
			[]string{"Up to 5 lakh", "5 to 10 lakh", "10 to 25 lakh", "25 lakh or more"}},
		{"sum_assured", "How much cover are you thinking of?", []string{
			"Up to 50 lakh", "50 lakh to 1 crore", "1 to 2 crore", "Over 2 crore", "Not sure yet"}},
		{"existing_life_cover", "Last one - do you already have a life policy?", []string{
			"No", "Yes, and I want to add to it", "Only what my employer gives me"}},
	},
	"car": {
		{"policy_status", "Where are you with the policy right now?", []string{
			"Renewing an existing one", "Just bought the car", "It has already expired",
			"Only third-party so far"}},
		{"car_make_model", "Which car is it - the make and model?", nil},
		{"rto_city", "Which city is it registered in?", nil},
		{"expiry_window", "When does the current policy expire?", []string{
			"Within 15 days", "16 to 45 days", "More than 45 days away",
			"Expired less than 3 months ago", "Expired more than 3 months ago"}},
		{"ncb", "Have you claimed on the policy in the last year?", []string{
			"No claim, so I have my no-claim bonus", "Yes, I claimed", "This is my first policy",
			"Not sure"}},
		{"coverage_type", "What kind of cover do you want?", []string{
			"Comprehensive - covers your car and others", "Third-party only - the legal minimum",
			"Own damage only - I already hold valid third-party cover",
			"Not sure - explain the difference"}},
	},
	"bike": {
		{"policy_status", "Where are you with the policy right now?", []string{
			"Renewing an existing one", "Just bought the bike", "It has already expired",
			"Only third-party so far"}},
		{"bike_make_model", "Which bike is it - the make and model?", nil},
		{"rto_city", "Which city is it registered in?", nil},
		{"expiry_window", "When does the current policy expire?", []string{
			"Within 15 days", "16 to 45 days", "More than 45 days away",
			"Expired less than 3 months ago", "Expired more than 3 months ago"}},
		{"ncb", "Have you claimed on the policy in the last year?", []string{
			"No claim, so I have my no-claim bonus", "Yes, I claimed", "This is my first policy",
			"Not sure"}},
		{"coverage_type", "What cover do you need?", []string{
			"Comprehensive - covers your bike and others", "Third-party only - the legal minimum",
			"Own damage only - I already hold valid third-party cover",
			"Not sure - explain the difference"}},
	},
	"travel": {
		{"trip_type", "What kind of trip is it?", []string{
			"A single trip", "Several trips this year", "Studying abroad",
			"Moving or working abroad"}},
		{"destination", "Where are you travelling?", nil},
		{"departure_window", "When do you leave?", []string{
			"Within a week", "In 2 to 4 weeks", "In 1 to 3 months", "Not booked yet"}},
		{"travellers", "Who is travelling?", []string{
			"Just me", "Me and my spouse", "Family with children", "A group"}},
		{"travel_purpose", "What is the purpose of the trip?", []string{
			"Holiday", "Business", "Study", "Visiting family"}},
		{"visa_proof", "Last one - do you need the policy as visa proof?", []string{
			"Yes, for a visa application", "No, just for cover"}},
	},
	"marine": {
		{"marine_type", "What would you like to insure?", []string{
			"Goods in transit (cargo)", "A vessel (hull)", "Both"}},
		{"policy_type", "Do you need one shipment covered, or a running policy?", []string{
			"One shipment", "A running annual policy", "Not sure"}},
		{"movement", "Which way are the goods moving?", []string{
			"Import", "Export", "Within India", "A mix"}},
		{"commodity", "What are you shipping?", nil},
		{"mode", "And by which mode?", []string{"Sea", "Air", "Road", "Rail", "A mix"}},
		{"value", "Roughly what value are we covering per shipment?", []string{
			"Up to 25 lakh", "25 lakh to 1 crore", "1 to 5 crore", "Over 5 crore"}},
	},
}

// KBLine maps our customer-facing line to the catalogue's line key, which is what picks the
// lookup tool. Car and bike are both motor there; marine sits inside fire-commercial.
var KBLine = map[string]string{
	"health": "health", "life": "life", "car": "motor", "bike": "motor",
	"travel": "travel", "marine": "fire-commercial",
}

// LookupTool is the MCP tool name for a line. Group has no funnel of its own — a company asking
// about GMC reaches a counsellor, not a chat funnel — but the tool exists and the model may
// reach it when someone asks.
var LookupTool = map[string]string{
	"health": "health_plan_lookup", "life": "life_plan_lookup",
	"motor": "motor_plan_lookup", "group": "group_plan_lookup",
	"fire-commercial": "fire_commercial_plan_lookup", "travel": "travel_plan_lookup",
}

// PageLines maps a product page path to its cover line. The site owns these routes
// (InsurancePage.jsx) and the workflow's S0 node maps them the same way.
var PageLines = map[string]string{
	"/health-insurance": "health",
	"/life-insurance":   "life",
	"/car-insurance":    "car",
	"/bike-insurance":   "bike",
	"/travel-insurance": "travel",
	"/marine-insurance": "marine",
}

// Disclosure is what we say we are, before anything else. The workflow marks it mandatory in
// the first message. It travels as its own field rather than inside the greeting: it is four
// lines of legalese, and in the bubble it pushed the product line and the question past the
// bottom of a 560px panel. The client shows it as a standing notice instead.
const Disclosure = "I'm an automated assistant — anything we discuss is indicative and subject " +
	"to underwriting; a licensed counsellor gives the real numbers."

var coverWords = map[string]string{
	"health": "health cover", "life": "life cover", "car": "car insurance",
	"bike": "two-wheeler insurance", "travel": "travel cover",
	"marine": "marine cargo and hull cover",
}

// Ordered: the first match wins, so "two wheeler" beats a bare "vehicle". Anchored on words a
// visitor actually types when stating intent, not on every mention of the word.
var linePatterns = []struct {
	line string
	re   *regexp.Regexp
}{
	{"bike", regexp.MustCompile(`(?i)\b(bike|two.?wheeler|scooter|motorcycle|motorbike|activa|bullet)\b`)},
	{"car", regexp.MustCompile(`(?i)\b(car|four.?wheeler|motor insurance|vehicle insurance|auto insurance)\b`)},
	{"health", regexp.MustCompile(`(?i)\b(health|mediclaim|medical (insurance|cover)|hospitali[sz]ation)\b`)},
	{"life", regexp.MustCompile(`(?i)\b(life|term (plan|insurance|cover)|endowment|ulip|pension|annuity)\b`)},
	{"travel", regexp.MustCompile(`(?i)\b(travel|trip|holiday|schengen|visa (insurance|cover))\b`)},
	{"marine", regexp.MustCompile(`(?i)\b(marine|cargo|shipment|freight|hull|transit)\b`)},
}

// skipWhen drops questions that make no sense given an earlier answer. The voice workflow's car
// and bike nodes carry these as "SKIP if new-vehicle": a car bought last week has no current
// policy, so asking when it expires and whether they claimed on it reads as not having listened.
// Matched against what the visitor said, not against what we asked.
var skipWhen = map[string]*regexp.Regexp{
	"car|expiry_window":  regexp.MustCompile(`(?i)just bought|brand.?new|new car|bought (it|the car) (last|this)`),
	"car|ncb":            regexp.MustCompile(`(?i)just bought|brand.?new|new car|bought (it|the car) (last|this)`),
	"bike|expiry_window": regexp.MustCompile(`(?i)just bought|brand.?new|new bike|bought (it|the bike) (last|this)`),
	"bike|ncb":           regexp.MustCompile(`(?i)just bought|brand.?new|new bike|bought (it|the bike) (last|this)`),
}

// Message is one turn of the conversation the client sends back every request.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// LineFromPage is the cover line a visitor is standing on, from the page context the widget
// already sends. product wins over page when they disagree: it only exists because the URL
// carried ?product=..., which is the more deliberate signal — a home-page ad landing that named
// the product outright. Any other path is no product, and the visitor gets the chooser.
func LineFromPage(product, page string) string {
	if p := strings.ToLower(strings.TrimSpace(product)); Funnels[p] != nil {
		return p
	}
	path := strings.ToLower(strings.TrimRight(strings.TrimSpace(page), "/"))
	if path == "" {
		path = "/"
	}
	return PageLines[path]
}

// LineOf is which of our six lines a piece of text is about, if any.
func LineOf(text string) string {
	for _, p := range linePatterns {
		if p.re.MatchString(text) {
			return p.line
		}
	}
	return ""
}

// ActiveLine reads the visitor's own messages only, current message winning, and falls back to
// the page. What the assistant said is deliberately excluded: it names every line when it offers
// the chooser, so matching on it would pick whichever came last in that list.
// `hint` is the line the server resolved on the previous turn, echoed back by the client. It
// exists because the transcript is a *window*, not the conversation: the client sends only the
// last few messages, so on a router-opened chat the visitor's one statement of what they want
// ("Health", tapped at the top) scrolls out of view around the fifth question. Without the hint
// the line resolved to empty mid-funnel, and an empty line means "ask them which cover they
// want" — so the funnel restarted at the router and the contact form let itself in, both of
// which a visitor saw. Deriving state from a truncated transcript is only safe if the truncation
// cannot outrun the derivation.
//
// The current message still wins, so "actually I need car insurance" switches immediately, and
// the hint is refreshed every turn from whatever won.
func ActiveLine(history []Message, q, hint, product, page string) string {
	if line := LineOf(q); line != "" {
		return line
	}
	for i := len(history) - 1; i >= 0; i-- {
		if history[i].Role != "user" {
			continue
		}
		if line := LineOf(history[i].Content); line != "" {
			return line
		}
	}
	if Funnels[hint] != nil {
		return hint
	}
	return LineFromPage(product, page)
}

// Remaining is the funnel questions not yet asked, skips excluded, in order.
//
// Matching on the question text rather than on a stored cursor is what keeps this stateless. The
// 28-character prefix is what flow.py used: enough to identify a question, short enough that a
// model rewording the tail of it still counts as asked. That tolerance is the whole point here —
// the model now writes these in its own words, so an exact match would find nothing and re-ask
// everything, which is the bug this change exists to fix.
func Remaining(line string, history []Message) []Question {
	asked := transcriptOf(history, "assistant")
	said := transcriptOf(history, "user")
	var out []Question
	for _, q := range live(line, said) {
		if strings.Contains(asked, prefixKey(q.Text)) {
			continue
		}
		out = append(out, q)
	}
	return out
}

// Progress is (step, steps) for the question about to be asked, 1-based, skips excluded.
//
// A qualification sequence with no visible end is one people abandon, and the visitor cannot see
// that a funnel is four questions rather than forty. Computed here rather than in the browser
// because a new car skips two of the six, and a number the bundle worked out for itself would
// drift from the funnel actually running.
func Progress(line string, history []Message) (int, int) {
	said := transcriptOf(history, "user")
	all := live(line, said)
	remaining := Remaining(line, history)
	if len(all) == 0 {
		return 0, 0
	}
	if len(remaining) == 0 {
		return len(all), len(all)
	}
	for i, q := range all {
		if q.Key == remaining[0].Key {
			return i + 1, len(all)
		}
	}
	return len(all), len(all)
}

// Ask renders one funnel turn.
//
// The options go out as flush "- " lines because the website's splitOptions.js lifts exactly
// that shape out of the body and renders it as tappable chips. It is the one place we want that
// parser to fire — everywhere else Tidy keeps dashes indented so it does not.
func Ask(q Question, preamble string) string {
	body := q.Text
	if p := strings.TrimSpace(preamble); p != "" {
		body = p + "\n\n" + q.Text
	}
	for _, o := range q.Options {
		body += "\n- " + o
	}
	return body
}

// Opener is the first thing the panel says.
//
// On a product page it does NOT ask which cover they want — they are standing on that product's
// page, and asking would look like we were not paying attention. It names the cover and asks
// that funnel's first question, which is where the conversation was always going. Deterministic:
// no tool call, no completion, nothing spent per panel open.
func Opener(line string) map[string]any {
	if qs := Remaining(line, nil); line != "" && len(qs) > 0 {
		step, steps := Progress(line, nil)
		return map[string]any{
			"line":       line,
			"step":       step,
			"steps":      steps,
			"disclosure": Disclosure,
			"greeting": "Hi! Happy to help you with " + coverWord(line) + " — we suggest a plan " +
				"only after a proper look at what you actually need.",
			"question": Ask(qs[0], ""),
			"reason":   "funnel",
		}
	}
	return map[string]any{
		"line":       nil,
		"disclosure": Disclosure,
		"greeting": "Hi! I'm the InsureNation assistant. I can help with new cover, a renewal, " +
			"or a claim that is stuck.",
		"question": "Which cover are you looking for?\n" +
			"- Health\n- Life\n- Car\n- Bike\n- Travel\n- Marine (cargo or hull)",
		"reason": "router",
	}
}

func coverWord(line string) string {
	if w := coverWords[line]; w != "" {
		return w
	}
	return line
}

// live is the line's questions with the skips for what the visitor already said removed.
func live(line string, said string) []Question {
	qs := Funnels[line]
	if len(qs) > maxQuestions {
		qs = qs[:maxQuestions]
	}
	out := make([]Question, 0, len(qs))
	for _, q := range qs {
		if re := skipWhen[line+"|"+q.Key]; re != nil && re.MatchString(said) {
			continue
		}
		out = append(out, q)
	}
	return out
}

func prefixKey(text string) string {
	lowered := strings.ToLower(text)
	if len(lowered) > 28 {
		lowered = lowered[:28]
	}
	return lowered
}

func transcriptOf(history []Message, role string) string {
	var b strings.Builder
	for _, m := range history {
		if m.Role != role {
			continue
		}
		b.WriteString(strings.ToLower(m.Content))
		b.WriteString("\n")
	}
	return b.String()
}

// routerOptions are the six cover lines the chooser offers, and the labels Tidy must let through
// on a turn where no line is known yet. Kept next to Opener's own copy of them so a change to
// one is visibly a change to both.
var routerOptions = []string{"Health", "Life", "Car", "Bike", "Travel", "Marine (cargo or hull)"}

// OfferedOptions is the choices this turn is allowed to present as chips: the current funnel
// question's own list, or the chooser's when the visitor has not named a cover yet.
//
// Tidy needs this because a trailing dashed list is either a menu or a prose list and the text
// cannot say which. The server asked the question, so the server knows.
func OfferedOptions(line string, history []Message) []string {
	if line == "" {
		return routerOptions
	}
	remaining := Remaining(line, history)
	if len(remaining) == 0 {
		// Past the funnel there is nothing left to offer. A dashed list on a shortlist turn is
		// prose about plans, and the panel's own shortcuts cover the next step.
		return nil
	}
	return remaining[0].Options
}

// AskedKeys is the funnel questions already put to the visitor, by key.
//
// Sent to the client so it can hand them back next turn. The funnel's position is derived from
// the transcript, and the transcript the client sends is a *window* — on a conversation with a
// few off-script detours the early questions slide out of it, and the funnel starts asking them
// again. Deriving state from a truncated record only works if the record cannot outrun it, so
// the parts that must survive travel separately.
func AskedKeys(line string, history []Message) []string {
	outstanding := map[string]bool{}
	for _, q := range Remaining(line, history) {
		outstanding[q.Key] = true
	}
	var asked []string
	for _, q := range Funnels[line] {
		if !outstanding[q.Key] {
			asked = append(asked, q.Key)
		}
	}
	return asked
}

// FoldAsked returns a transcript copy carrying a synthetic assistant message for each question
// the client reports as already asked, so every derivation below sees them.
//
// Only for working out where the funnel is. These messages are never sent to the model — it gets
// the real transcript — because a question it can see twice is a question it may answer twice.
// Unknown keys are dropped: this arrives from the browser, and the worst a forged one could do is
// skip a question, which is bounded and harmless, but only for keys that exist at all.
func FoldAsked(history []Message, line string, asked []string) []Message {
	if len(asked) == 0 {
		return history
	}
	want := map[string]bool{}
	for _, key := range asked {
		want[key] = true
	}
	out := make([]Message, 0, len(history)+len(asked))
	for _, q := range Funnels[line] {
		if want[q.Key] {
			out = append(out, Message{Role: "assistant", Content: q.Text})
		}
	}
	return append(out, history...)
}
