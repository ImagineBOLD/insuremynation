package assistant

// The messaging permission. It is a compliance record, not a pleasantry: the CRM's send gate
// reads it, so a lead that arrives without one is a lead nobody may WhatsApp.

import (
	"context"
	"strings"
	"testing"
)

func TestTheWhatsAppAskCarriesTheQuestionAndItsChips(t *testing.T) {
	got := WhatsAppAsk("Nehal Kumar")
	if !strings.Contains(got, WhatsAppQuestion) {
		t.Fatalf("the permission question is missing:\n%s", got)
	}
	// Flush dashes, so the panel renders two chips rather than a paragraph.
	if !strings.Contains(got, "\n- Yes, message me") || !strings.Contains(got, "\n- No thanks") {
		t.Fatalf("options are not flush dash lines:\n%s", got)
	}
	// First name only. "Thank you, Nehal Kumar" reads like a form letter.
	if !strings.Contains(got, "Thank you, Nehal") || strings.Contains(got, "Nehal Kumar") {
		t.Fatalf("name not shortened to the first name:\n%s", got)
	}
}

func TestTheWhatsAppAskSurvivesAMissingName(t *testing.T) {
	got := WhatsAppAsk("")
	if strings.Contains(got, "Thank you,") {
		t.Fatalf("dangling comma with no name:\n%s", got)
	}
	if !strings.Contains(got, WhatsAppQuestion) {
		t.Fatalf("question missing:\n%s", got)
	}
}

func TestAwaitingWhatsAppReadsTheLastThingWeSaid(t *testing.T) {
	asked := []Message{
		{Role: "assistant", Content: "How much cover do you have in mind?"},
		{Role: "user", Content: "10 to 25 lakh"},
		{Role: "assistant", Content: WhatsAppAsk("Nehal")},
	}
	if !AwaitingWhatsApp(asked) {
		t.Fatal("the permission question was not recognised as outstanding")
	}
	answered := append(append([]Message{}, asked...),
		Message{Role: "user", Content: "Yes, message me"},
		Message{Role: "assistant", Content: ContactAck("Nehal", "granted")},
	)
	if AwaitingWhatsApp(answered) {
		t.Fatal("still waiting after the answer was given and acknowledged")
	}
	if AwaitingWhatsApp(nil) {
		t.Fatal("waiting on an empty transcript")
	}
}

func TestConsentIsGrantedUnlessItIsARefusal(t *testing.T) {
	// They were offered two buttons, so anything that is not a refusal is a yes.
	for _, yes := range []string{"Yes, message me", "yes please", "sure, go ahead", "haan", "ok"} {
		if got := ReadConsent(yes); got != "granted" {
			t.Fatalf("%q read as %q", yes, got)
		}
	}
	// A refusal is `denied`, never an omission: "no record" and "they said no" are different
	// facts and the send gate treats them differently.
	for _, no := range []string{"No thanks", "no", "don't message me", "not now", "rather not", "nahi"} {
		if got := ReadConsent(no); got != "denied" {
			t.Fatalf("%q read as %q", no, got)
		}
	}
}

func TestARefusalIsAcknowledgedAsWarmlyAsAYes(t *testing.T) {
	yes := ContactAck("Nehal", "granted")
	no := ContactAck("Nehal", "denied")
	if !strings.HasPrefix(yes, "Perfect, noted.") {
		t.Fatalf("yes: %q", yes)
	}
	if !strings.HasPrefix(no, "Of course, no WhatsApp.") {
		t.Fatalf("no: %q", no)
	}
	for _, s := range []string{yes, no} {
		if !strings.Contains(s, "within one working day") {
			t.Fatalf("the callback promise is missing: %q", s)
		}
		// The safety line the workflow requires on the close.
		if !strings.Contains(s, "never ask for your PAN") {
			t.Fatalf("the never-asks line is missing: %q", s)
		}
	}
}

func TestTheContactCloseNeverPromisesWhatWeCannotDo(t *testing.T) {
	// The guard runs on model prose, not on these canned strings, so they are checked directly:
	// a premium or a duration written into a constant would ship straight past it.
	for _, s := range []string{
		WhatsAppAsk("Nehal"),
		ContactAck("Nehal", "granted"),
		ContactAck("", "denied"),
	} {
		if got := Leaked(s); len(got) != 0 {
			t.Fatalf("a canned contact string trips the guardrail %v: %q", got, s)
		}
	}
}

func TestConsentAskedIsNotTheSameAsAwaiting(t *testing.T) {
	// The distinction that stops the loop. After the close, the question is still *in* the
	// transcript but is no longer the last thing we said — and the contact details ride every
	// later turn, so "this turn has a phone" cannot gate anything by itself.
	closed := []Message{
		{Role: "assistant", Content: WhatsAppAsk("Utsav")},
		{Role: "user", Content: "Yes, message me"},
		{Role: "assistant", Content: ContactAck("Utsav", "granted")},
	}
	if AwaitingWhatsApp(closed) {
		t.Fatal("still awaiting after the close")
	}
	if !ConsentAsked(closed) {
		t.Fatal("the question was asked but ConsentAsked says otherwise — this is the loop")
	}
	if ConsentAsked([]Message{{Role: "assistant", Content: "Who would the cover be for?"}}) {
		t.Fatal("a funnel question counted as the permission question")
	}
}

func TestTheVisitorsOwnWordsNeverCountAsAsking(t *testing.T) {
	// Only what we said counts. A visitor who quotes the question back must not close it.
	quoted := []Message{{Role: "user", Content: WhatsAppQuestion}}
	if ConsentAsked(quoted) || AwaitingWhatsApp(quoted) {
		t.Fatal("the visitor's own message counted as us having asked")
	}
}

// deadAgent answers with a knowledge base that cannot be reached, so Answer() runs its gates and
// then degrades. Enough to assert which gate fired, with no network and no model.
func deadAgent() *Agent {
	return NewAgent(NewMCP("http://127.0.0.1:1", "k"), NewLLM("http://127.0.0.1:1", "k", ""))
}

func TestAStaleConsentCannotCloseAConversationThatNeverStarted(t *testing.T) {
	// The one a visitor saw: a fresh chat, first message "Car", and the assistant replied with
	// the sign-off. The client persists the close state so it survives the transcript *window* —
	// which means it also survives the transcript being thrown away by a reset. The client
	// clears it now; this is the half that holds when it does not.
	got := deadAgent().Answer(context.Background(), Request{
		Q:       "Car",
		Consent: "asked", // left over from a previous conversation
		Page:    "/",
	})
	if strings.Contains(got.Answer, "passed this to our team") {
		t.Fatalf("a stale consent closed a conversation with no contact details:\n%s", got.Answer)
	}
	if got.Reason == "contact" {
		t.Fatalf("reason=contact with no phone on the request")
	}
	if got.Consent != "" {
		t.Fatalf("stale consent state was echoed back as %q", got.Consent)
	}
	if got.Record != nil {
		t.Fatal("a consent record was written for a permission nobody was asked for")
	}
}

func TestAStaleGrantedConsentDoesNotSuppressTheQuestionForANewLead(t *testing.T) {
	// The mirror image: carrying "granted" into a conversation whose visitor has now given a
	// number must not skip asking them. Consent belongs to a person, not to a browser tab.
	got := deadAgent().Answer(context.Background(), Request{
		Q:     "here are my details",
		Phone: "+919876543210",
		Name:  "Utsav",
		// The client clears this on reset; if it ever leaks through, the question must still be
		// asked rather than assumed.
		Consent: "",
		Page:    "/",
	})
	if !strings.Contains(got.Answer, WhatsAppQuestion) {
		t.Fatalf("the permission was not asked for a new contact:\n%s", got.Answer)
	}
	if got.Consent != consentAsked {
		t.Fatalf("consent state %q, want %q", got.Consent, consentAsked)
	}
}

func TestThePermissionIsAskedOnceNotOnEveryTurnCarryingAPhone(t *testing.T) {
	// The loop: the client re-sends contact details on every turn after the form, so the ask
	// cannot be gated on "this turn has a phone" alone.
	closed := []Message{
		{Role: "assistant", Content: WhatsAppAsk("Utsav")},
		{Role: "user", Content: "Yes, message me"},
		{Role: "assistant", Content: ContactAck("Utsav", "granted")},
	}
	got := deadAgent().Answer(context.Background(), Request{
		Q:       "compare the policies",
		History: closed,
		Phone:   "+919876543210",
		Name:    "Utsav",
		Consent: "granted",
		Page:    "/",
	})
	if strings.Contains(got.Answer, WhatsAppQuestion) {
		t.Fatalf("the permission question repeated after it was answered:\n%s", got.Answer)
	}
	if got.Reason == "contact" {
		t.Fatal("the close fired again on an ordinary turn")
	}
}
