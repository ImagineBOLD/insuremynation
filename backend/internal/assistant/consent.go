package assistant

// The contact close: acknowledge the details, ask the one messaging permission, record the
// answer.
//
// Ported from the corpus RAG's flow.py, where it was the first two rules of the precedence chain
// — and it is the one part of that chain that genuinely must stay a gate rather than become
// guidance. A permission is not something a model should be free to phrase its own way: what
// goes in the record has to be the exact words the visitor was shown, because "they agreed" is
// not a record. So these turns are canned, make no model call, and cost nothing.
//
// Why it matters more than it looks: the consent row is the lawful basis for messaging the lead,
// and the CRM's send gate reads it. A lead that arrives without one is a lead nobody may WhatsApp.

import (
	"regexp"
	"strings"
)

// WhatsAppQuestion is verbatim from the workflow's S4b node, and it is also the string stored as
// `consent_text`. Change it here and you change what the record says the visitor was asked, so
// it must stay in step with what they actually saw.
const WhatsAppQuestion = "May we send you the plan details and updates on WhatsApp on this number?"

// WhatsAppOptions are rendered as flush dash lines, which the panel turns into two chips.
var WhatsAppOptions = []string{"Yes, message me", "No thanks"}

// Anything that is not a refusal is a yes — they were offered two buttons, and a visitor who
// taps neither and types "sure, go ahead" has agreed. "nahi" is there because the assistant
// mirrors Hinglish and people answer in it.
var consentNo = regexp.MustCompile(`(?i)\bno\b|don'?t|do not|not now|rather not|nahi`)

// WhatsAppAsk acknowledges the details, then asks the one permission question.
func WhatsAppAsk(name string) string {
	who := ""
	if first := firstName(name); first != "" {
		who = ", " + first
	}
	body := "Thank you" + who + " — noted.\n\n" + WhatsAppQuestion
	for _, o := range WhatsAppOptions {
		body += "\n- " + o
	}
	return body
}

// AwaitingWhatsApp is true when the last thing we said was the permission question.
func AwaitingWhatsApp(history []Message) bool {
	for i := len(history) - 1; i >= 0; i-- {
		if history[i].Role != "assistant" {
			continue
		}
		return strings.Contains(history[i].Content, WhatsAppQuestion)
	}
	return false
}

// ReadConsent turns their answer into the CRM's vocabulary. A refusal is `denied`, never an
// omission: "no record" and "they said no" are different facts and the send gate treats them
// differently.
func ReadConsent(q string) string {
	if consentNo.MatchString(q) {
		return "denied"
	}
	return "granted"
}

// ContactAck is the close. Never a lookup — the visitor sent details, not a question.
func ContactAck(name, consent string) string {
	who := ""
	if first := firstName(name); first != "" {
		who = " " + first
	}
	// Four words at most, and a refusal is acknowledged exactly as warmly as a yes.
	lead := ""
	switch consent {
	case "granted":
		lead = "Perfect, noted. "
	case "denied":
		lead = "Of course, no WhatsApp. "
	}
	return lead + "Thank you" + who + " — I have passed this to our team. A counsellor will call " +
		"you within one working day to go through the options and answer anything I could not. " +
		"They will never ask for your PAN, Aadhaar, an OTP or any payment over chat."
}

func firstName(name string) string {
	fields := strings.Fields(strings.TrimSpace(name))
	if len(fields) == 0 {
		return ""
	}
	return fields[0]
}

// ConsentAsked is true when the permission question appears anywhere in the transcript.
//
// Distinct from AwaitingWhatsApp, which asks whether it was the *last* thing we said. The
// difference is what stops the question repeating: the client re-sends the contact details on
// every turn after the form, so "this turn carries a phone" stays true for the rest of the
// conversation and cannot gate anything on its own.
func ConsentAsked(history []Message) bool {
	for _, m := range history {
		if m.Role == "assistant" && strings.Contains(m.Content, WhatsAppQuestion) {
			return true
		}
	}
	return false
}
