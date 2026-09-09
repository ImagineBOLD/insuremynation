package assistant

// The funnel's stage arithmetic, and the two reported bugs it exists to prevent: a sequence that
// restarts when a visitor asks something off-script, and a question asked twice.

import (
	"strings"
	"testing"
)

func turns(pairs ...string) []Message {
	out := make([]Message, 0, len(pairs))
	for i, text := range pairs {
		role := "assistant"
		if i%2 == 1 {
			role = "user"
		}
		out = append(out, Message{Role: role, Content: text})
	}
	return out
}

func TestRemainingStartsWithTheWholeFunnel(t *testing.T) {
	if got := Remaining("health", nil); len(got) != 6 || got[0].Key != "members" {
		t.Fatalf("fresh health funnel: %d questions, first %q", len(got), got[0].Key)
	}
}

func TestAnAskedQuestionDropsOut(t *testing.T) {
	history := turns(Ask(Funnels["health"][0], ""), "family floater")
	got := Remaining("health", history)
	if len(got) != 5 || got[0].Key != "eldest_age" {
		t.Fatalf("after one question: %d left, next %q", len(got), got[0].Key)
	}
}

func TestAnOffScriptQuestionDoesNotRestartTheFunnel(t *testing.T) {
	// The reported bug. Two questions asked, then the visitor asks about a plan and the
	// assistant answers it — the funnel must be exactly where it was, not back at the start.
	base := turns(
		Ask(Funnels["health"][0], ""), "family floater",
		Ask(Funnels["health"][1], ""), "36 to 50",
	)
	before := Remaining("health", base)

	interrupted := append(append([]Message{}, base...),
		Message{Role: "user", Content: "wait, what does Care Supreme cover?"},
		Message{Role: "assistant", Content: "Care Supreme covers day care procedures and AYUSH treatment. " +
			Ask(Funnels["health"][2], "")},
	)
	after := Remaining("health", interrupted)

	if len(after) != len(before)-1 {
		t.Fatalf("funnel moved by %d questions across an interruption, want 1 (before %d, after %d)",
			len(before)-len(after), len(before), len(after))
	}
	if after[0].Key != "sum_insured" {
		t.Fatalf("next question after the interruption is %q, want sum_insured", after[0].Key)
	}
}

func TestReAskingTheSameQuestionDoesNotAdvance(t *testing.T) {
	// The other half of the fix: the assistant answers and re-asks the SAME question. That turn
	// must leave the funnel exactly where it was.
	asked := Ask(Funnels["health"][0], "")
	once := turns(asked, "what do you even cover?")
	twice := append(append([]Message{}, once...),
		Message{Role: "assistant", Content: "We place health, life, car, bike, travel and marine cover. " + asked},
		Message{Role: "user", Content: "just me"},
	)
	if a, b := Remaining("health", once), Remaining("health", twice); a[0].Key != b[0].Key {
		t.Fatalf("re-asking advanced the funnel: %q then %q", a[0].Key, b[0].Key)
	}
}

func TestAModelRewordingTheTailStillCountsAsAsked(t *testing.T) {
	// The model writes these in its own words now, so the match is on a 28-character prefix. An
	// exact match would find nothing and re-ask everything, which is the bug this change fixes.
	reworded := "Does anyone being covered have an existing medical condition at all? Just so we " +
		"shortlist insurers who will take the case."
	history := turns(reworded, "diabetes")
	for _, q := range Remaining("health", history) {
		if q.Key == "pre_existing" {
			t.Fatal("a reworded question was not recognised as asked, so it would be asked again")
		}
	}
}

func TestANewCarSkipsTwoQuestions(t *testing.T) {
	// A car bought last week has no current policy, so asking when it expires and whether they
	// claimed on it reads as not having listened.
	history := turns("Where are you with the policy right now?", "just bought the car")
	got := Remaining("car", history)
	for _, q := range got {
		if q.Key == "expiry_window" || q.Key == "ncb" {
			t.Fatalf("%q was not skipped for a new car", q.Key)
		}
	}
	if _, steps := Progress("car", history); steps != 4 {
		t.Fatalf("a new car funnel is %d questions, want 4", steps)
	}
}

func TestProgressCanCountDownMidConversation(t *testing.T) {
	// "1 of 6" then "2 of 4" is correct and deliberate, and the panel is built for it: the skip
	// only becomes known once the visitor says the car is new, so the total shrinks under them.
	if step, steps := Progress("car", nil); step != 1 || steps != 6 {
		t.Fatalf("fresh car funnel is %d of %d, want 1 of 6", step, steps)
	}
	history := turns("Where are you with the policy right now?", "just bought the car")
	if step, steps := Progress("car", history); step != 2 || steps != 4 {
		t.Fatalf("after a new car it is %d of %d, want 2 of 4", step, steps)
	}
}

func TestProgressIsCompleteWhenNothingIsLeft(t *testing.T) {
	var history []Message
	for _, q := range Funnels["travel"] {
		history = append(history,
			Message{Role: "assistant", Content: Ask(q, "")},
			Message{Role: "user", Content: "yes"},
		)
	}
	if got := Remaining("travel", history); len(got) != 0 {
		t.Fatalf("%d questions left after asking all six", len(got))
	}
	if step, steps := Progress("travel", history); step != steps || steps != 6 {
		t.Fatalf("finished funnel is %d of %d, want 6 of 6", step, steps)
	}
}

func TestActiveLineReadsTheVisitorNotTheAssistant(t *testing.T) {
	// The router turn names all six lines. Matching on assistant text would pick whichever came
	// last in that list.
	history := turns("Which cover are you looking for?\n- Health\n- Life\n- Car\n- Bike\n- Travel\n- Marine (cargo or hull)")
	if got := ActiveLine(history, "i need health cover for my parents", "", "", ""); got != "health" {
		t.Fatalf("active line %q, want health", got)
	}
}

func TestTheCurrentMessageWinsOverTheHistory(t *testing.T) {
	history := turns("Who would the cover be for?", "health cover please")
	if got := ActiveLine(history, "actually I need car insurance", "", "", ""); got != "car" {
		t.Fatalf("active line %q, want car", got)
	}
}

func TestBikeBeatsABareVehicleWord(t *testing.T) {
	if got := LineOf("i want insurance for my two wheeler"); got != "bike" {
		t.Fatalf("line %q, want bike", got)
	}
}

func TestProductParameterBeatsThePath(t *testing.T) {
	// /?product=health is a home-page ad landing that named the product outright, which is the
	// more deliberate signal.
	if got := LineFromPage("health", "/"); got != "health" {
		t.Fatalf("line %q, want health", got)
	}
	if got := LineFromPage("", "/car-insurance"); got != "car" {
		t.Fatalf("line %q, want car", got)
	}
	if got := LineFromPage("nonsense", "/about"); got != "" {
		t.Fatalf("line %q, want none", got)
	}
}

func TestOpenerOnAProductPageAsksThatFunnelsFirstQuestion(t *testing.T) {
	got := Opener("health")
	if got["reason"] != "funnel" {
		t.Fatalf("reason %v, want funnel", got["reason"])
	}
	question, _ := got["question"].(string)
	if !strings.HasPrefix(question, "Who would the cover be for?") {
		t.Fatalf("opener question %q", question)
	}
	if !strings.Contains(question, "\n- Just me") {
		t.Fatalf("opener options are not flush dashes: %q", question)
	}
	if got["disclosure"] != Disclosure {
		t.Fatal("the mandatory disclosure is missing from the opener")
	}
	if got["step"] != 1 || got["steps"] != 6 {
		t.Fatalf("opener progress %v of %v, want 1 of 6", got["step"], got["steps"])
	}
}

func TestOpenerElsewhereOffersTheChooser(t *testing.T) {
	got := Opener("")
	if got["reason"] != "router" {
		t.Fatalf("reason %v, want router", got["reason"])
	}
	// No step/steps on the router turn: the panel draws no progress bar for a question that is
	// not part of a funnel.
	if _, ok := got["step"]; ok {
		t.Fatal("the router turn must carry no step count")
	}
}

func TestEveryLineHasAKnowledgeBaseToolBehindIt(t *testing.T) {
	// A funnel whose line does not map to a lookup tool would qualify a visitor and then have
	// nothing to shortlist from.
	for line := range Funnels {
		kb, ok := KBLine[line]
		if !ok {
			t.Fatalf("%q has no catalogue line", line)
		}
		if LookupTool[kb] == "" {
			t.Fatalf("%q maps to catalogue line %q, which has no lookup tool", line, kb)
		}
	}
}

func TestFunnelGuidanceNamesTheOutstandingQuestionAndForbidsRestarting(t *testing.T) {
	history := turns(Ask(Funnels["life"][0], ""), "protect my family")
	got := funnelGuidance("life", history)
	if !strings.Contains(got, "How old are you?") {
		t.Fatalf("guidance does not carry the next question: %q", got)
	}
	if !strings.Contains(got, "life_plan_lookup") {
		t.Fatalf("guidance does not name the line's tool: %q", got)
	}
	if !strings.Contains(got, "do not restart") {
		t.Fatalf("guidance does not forbid restarting the sequence: %q", got)
	}
}

func TestFunnelGuidanceStopsAskingOnceTheFunnelIsDone(t *testing.T) {
	var history []Message
	for _, q := range Funnels["health"] {
		history = append(history,
			Message{Role: "assistant", Content: Ask(q, "")},
			Message{Role: "user", Content: "yes"},
		)
	}
	got := funnelGuidance("health", history)
	if !strings.Contains(got, "Do not ask another one") {
		t.Fatalf("finished funnel still invites a question: %q", got)
	}
}

func TestTheLineSurvivesTheHistoryWindowSliding(t *testing.T) {
	// The reported regression, exactly. A chat opened from a non-product page: the visitor says
	// "Health" once, at the top. The client sends a window of the transcript, so five questions
	// later that message is gone from it — and with no line the service decides nobody has chosen
	// a cover and restarts the funnel at the router. The hint is what stops that.
	windowed := turns(
		"Does anyone being covered have an existing medical condition?", "diabetes",
		"How much cover do you have in mind?", "10 to 25 lakh",
		"Which city are you in?", "delhi",
	)
	if got := ActiveLine(windowed, "delhi", "", "", "/"); got != "" {
		t.Fatalf("precondition failed: the window alone resolved %q", got)
	}
	if got := ActiveLine(windowed, "delhi", "health", "", "/"); got != "health" {
		t.Fatalf("the hint did not hold the line: %q", got)
	}
}

func TestTheCurrentMessageStillBeatsTheHint(t *testing.T) {
	// Sticky must not mean stuck. Someone who says they want car insurance gets car insurance.
	if got := ActiveLine(nil, "actually I need car insurance", "health", "", "/"); got != "car" {
		t.Fatalf("line %q, want car", got)
	}
}

func TestAnUnknownHintIsIgnored(t *testing.T) {
	// The hint comes from the client, so it is not trusted: only one of our six lines counts.
	if got := ActiveLine(nil, "hello", "../../etc/passwd", "", "/"); got != "" {
		t.Fatalf("an unknown hint was accepted: %q", got)
	}
	if got := ActiveLine(nil, "hello", "motor", "", "/"); got != "" {
		t.Fatalf("a catalogue line is not a funnel line, got %q", got)
	}
}

func TestPageStillWinsWhenThereIsNoHint(t *testing.T) {
	if got := ActiveLine(nil, "hello", "", "", "/car-insurance"); got != "car" {
		t.Fatalf("line %q, want car", got)
	}
}

func TestAnOpenQuestionIsNotGivenAChoiceList(t *testing.T) {
	// "Which city are you in?" has no choice list, and the model invented eight cities for it.
	// The guard refused to make them chips, so the visitor read a dashed list as literal text.
	history := []Message{}
	for _, q := range Funnels["health"][:4] {
		history = append(history,
			Message{Role: "assistant", Content: Ask(q, "")},
			Message{Role: "user", Content: "yes"})
	}
	got := funnelGuidance("health", history)
	if !strings.Contains(got, "Which city are you in?") {
		t.Fatalf("guidance is not on the city question:\n%s", got)
	}
	if !strings.Contains(got, "NO choice list") {
		t.Fatalf("an open question was not marked as open:\n%s", got)
	}
	if strings.Contains(got, "\n- ") {
		t.Fatalf("guidance offered options for an open question:\n%s", got)
	}
}

func TestFoldedAskedKeysHoldTheFunnelWhenTheWindowSlides(t *testing.T) {
	// The second instance of the same root cause: the funnel's position is derived from the
	// transcript too, so at a short window the early questions vanish and get asked again. The
	// client hands back the keys instead.
	windowed := turns("Which city are you in?", "delhi")
	if got := Remaining("health", windowed); got[0].Key != "members" {
		t.Fatalf("precondition failed: window alone resolved next=%q", got[0].Key)
	}
	folded := FoldAsked(windowed, "health",
		[]string{"members", "eldest_age", "pre_existing", "sum_insured", "city"})
	got := Remaining("health", folded)
	if len(got) != 1 || got[0].Key != "current_policy_status" {
		t.Fatalf("%d questions left, next %q — want just current_policy_status", len(got), got[0].Key)
	}
	if step, steps := Progress("health", folded); step != 6 || steps != 6 {
		t.Fatalf("progress %d of %d, want 6 of 6", step, steps)
	}
}

func TestAskedKeysRoundTrip(t *testing.T) {
	// What the service reports is what the client hands back, so the two must agree.
	history := turns(
		Ask(Funnels["health"][0], ""), "just me",
		Ask(Funnels["health"][1], ""), "36 to 50",
	)
	keys := AskedKeys("health", history)
	if len(keys) != 2 || keys[0] != "members" || keys[1] != "eldest_age" {
		t.Fatalf("asked keys %q", keys)
	}
	// Folding them into an empty transcript must reproduce the same position.
	if got := Remaining("health", FoldAsked(nil, "health", keys)); got[0].Key != "pre_existing" {
		t.Fatalf("round trip lost the place: next %q", got[0].Key)
	}
}

func TestAForgedAskedKeyIsIgnored(t *testing.T) {
	// This arrives from the browser. Only keys that exist count; the worst a real one could do is
	// skip a question the visitor is then not asked, which is bounded.
	folded := FoldAsked(nil, "health", []string{"'; DROP TABLE leads--", "members"})
	got := Remaining("health", folded)
	if len(got) != 5 || got[0].Key != "eldest_age" {
		t.Fatalf("%d left, next %q — the forged key should have been dropped", len(got), got[0].Key)
	}
}

func TestFoldedMessagesNeverReachTheModel(t *testing.T) {
	// They are synthetic. A question the model can see twice is a question it may answer twice,
	// so the fold is for derivation only and historyMessages must be given the real transcript.
	real := turns("Which city are you in?", "delhi")
	folded := FoldAsked(real, "health", []string{"members", "eldest_age"})
	if len(folded) <= len(real) {
		t.Fatal("fold added nothing")
	}
	if got := len(historyMessages(real)); got != len(real) {
		t.Fatalf("historyMessages saw %d of %d real messages", got, len(real))
	}
}
