package assistant

// The outgoing guardrail, and the funnel's stage arithmetic.
//
// Every case in the guardrail half is a bug that reached a customer through the corpus RAG,
// ported from that repo's tests/test_answer.py. They are here rather than trusted to the prompt
// for the reason that file states: a cap that lives only in a prompt is a request.

import (
	"strings"
	"testing"
)

func TestCapCutsAtASentenceEnd(t *testing.T) {
	long := strings.Repeat("Cataract surgery is covered under this policy. ", 40)
	got := Cap(long)
	if len([]rune(got)) > maxAnswerChars {
		t.Fatalf("cap not enforced: %d chars", len([]rune(got)))
	}
	if !strings.HasSuffix(got, ".") {
		t.Fatalf("cap did not land on a sentence end: %q", got[len(got)-40:])
	}
}

func TestCapLeavesAShortAnswerAlone(t *testing.T) {
	short := "Yes, cataract surgery is covered, subject to the policy's own limits."
	if got := Cap(short); got != short {
		t.Fatalf("short answer altered: %q", got)
	}
}

func TestCapWithNoSentenceEndStillFits(t *testing.T) {
	// A single unpunctuated run has no sentence to cut at. It must still come back inside the
	// cap rather than whole.
	got := Cap(strings.Repeat("cover ", 300))
	if len([]rune(got)) > maxAnswerChars {
		t.Fatalf("cap not enforced without punctuation: %d chars", len([]rune(got)))
	}
}

func TestTidyIndentsFlushDashesSoTheChipParserCannotEatThem(t *testing.T) {
	// splitOptions.js lifts a run of column-0 "- " lines out of the body and renders them as
	// chips, removing them from the message. On an answer that loses the content.
	got := tidyH("The policy covers:\n- day care procedures\n- AYUSH treatment")
	for _, line := range strings.Split(got, "\n") {
		if strings.HasPrefix(line, "- ") {
			t.Fatalf("flush dash survived Tidy: %q", got)
		}
	}
	if !strings.Contains(got, "day care procedures") {
		t.Fatalf("Tidy dropped content: %q", got)
	}
}

func TestTidyStripsEmphasisAndHeadings(t *testing.T) {
	got := tidyH("## Cover\n**Care Supreme** includes __AYUSH__ treatment.")
	for _, bad := range []string{"**", "__", "##"} {
		if strings.Contains(got, bad) {
			t.Fatalf("markup survived Tidy: %q", got)
		}
	}
	if !strings.Contains(got, "Care Supreme includes AYUSH treatment.") {
		t.Fatalf("Tidy mangled the sentence: %q", got)
	}
}

func TestFunnelQuestionKeepsItsFlushDashes(t *testing.T) {
	// The one place the chip parser is meant to fire. Ask() must not be run through Tidy.
	got := Ask(Funnels["health"][0], "")
	if !strings.Contains(got, "\n- Just me") {
		t.Fatalf("funnel options are not flush: %q", got)
	}
}

func TestLeakedCatchesAPremiumInProse(t *testing.T) {
	// The first live run of the RAG produced exactly this. It carries no premium word, so the
	// document classifier alone waved it through.
	if got := Leaked("Cover costs ₹8,000 per annum for a family of four."); !has(got, tagPremium) {
		t.Fatalf("premium prose not caught: %v", got)
	}
}

func TestLeakedCatchesAPremiumWordWithAFigure(t *testing.T) {
	if got := Leaked("The premium is Rs 12,500 for this plan."); !has(got, tagPremium) {
		t.Fatalf("premium with a figure not caught: %v", got)
	}
}

func TestLeakedLeavesABenefitLimitAlone(t *testing.T) {
	// Deliberately quotable: this is what the cover does, not what it costs. Widening the money
	// check until it eats this would make the assistant useless.
	for _, safe := range []string{
		"The policy pays up to ₹1 lakh for day care procedures.",
		"Sum insured options run from ₹5 lakh to ₹1 crore.",
		"Room rent is covered up to the sum insured.",
	} {
		if got := Leaked(safe); len(got) != 0 {
			t.Fatalf("benefit limit withheld: %q -> %v", safe, got)
		}
	}
}

func TestLeakedCatchesAParaphrasedWaitingPeriod(t *testing.T) {
	// None of these share the words "waiting period", and each one came out of a live run.
	for _, bad := range []string{
		"You must wait 24 months before claiming for maternity.",
		"Maternity needs 24 months of continuous coverage before you can claim.",
		"Continuous maternity coverage for 24 months is required.",
		"Pre-existing conditions are covered after two years.",
		"There is a 2-year wait for this benefit.",
	} {
		if got := Leaked(bad); !has(got, tagWaiting) {
			t.Fatalf("paraphrased waiting period not caught: %q -> %v", bad, got)
		}
	}
}

func TestLeakedCatchesTheNamedWaitingPeriodToo(t *testing.T) {
	// The phrase itself is a trip: an answer discussing durations is the turn to hand to a
	// specialist. This is why retryNote says "qualifying period" instead.
	if got := Leaked("A waiting period applies to this benefit."); !has(got, tagWaiting) {
		t.Fatalf("named waiting period not caught: %v", got)
	}
	if got := Leaked(retryNote); len(got) != 0 {
		t.Fatalf("the retry instruction itself trips the guard, so the retry can never pass: %v", got)
	}
}

func TestLeakedLeavesAnOrdinaryDurationAlone(t *testing.T) {
	// "the bonus increases after 2 years" is not a waiting period, which is why the verb list in
	// waitProse stays closed rather than matching any "after <duration>".
	for _, safe := range []string{
		"The cumulative bonus increases after 2 years of renewal.",
		"Policy terms of 1, 2 or 3 years are available.",
		"Post-hospitalisation expenses are covered for 180 days after discharge.",
	} {
		if got := Leaked(safe); has(got, tagWaiting) {
			t.Fatalf("ordinary duration withheld: %q -> %v", safe, got)
		}
	}
}

func TestLeakedCatchesADenseRateTable(t *testing.T) {
	// An unlabelled premium table the keyword rule misses. Digit density separates a rate chart
	// (~0.60) from prose (~0.05).
	table := strings.Repeat("18-35 4500 36-50 7200 51-60 11800 61-65 18400 ", 8)
	if got := Leaked(table); !has(got, tagPremium) {
		t.Fatalf("dense rate table not caught: %v", got)
	}
}

func TestLeakedIgnoresAShortDigitFragment(t *testing.T) {
	// The density rule needs enough text to be meaningful; on a short string it is noise.
	if got := Leaked("Plan 2"); len(got) != 0 {
		t.Fatalf("short fragment flagged: %v", got)
	}
}

func TestUncoveredInsurersAreRefusedByName(t *testing.T) {
	cases := map[string]string{
		"tell me about LIC Jeevan Anand":     "LIC",
		"do you have Bajaj Allianz health":   "Bajaj Allianz",
		"tata aia term plan details":         "Tata AIA",
		"what about SBI Life vs SBI General": "SBI Life",
		"is reliance nippon life any good":   "Reliance Nippon Life",
	}
	for q, want := range cases {
		if got := UncoveredInsurer(q); got != want {
			t.Fatalf("%q: got %q, want %q", q, got, want)
		}
	}
}

func TestFormerNamesOfInsurersWeDoPlaceFallThrough(t *testing.T) {
	// An empty result means "not a miss". Max Bupa is Niva Bupa, Reliance General is IndusInd —
	// refusing these would refuse insurers we actually place.
	for _, q := range []string{
		"max bupa health plans",
		"religare care plan",
		"reliance general car insurance",
		"future generali travel",
	} {
		if got := UncoveredInsurer(q); got != "" {
			t.Fatalf("%q was refused as %q, but we place that insurer", q, got)
		}
	}
}

func TestInsurersWePlaceAreNotRefused(t *testing.T) {
	for _, q := range []string{
		"care supreme vs niva bupa aspire",
		"hdfc ergo optima secure",
		"star health family plan",
		"navigate to the health page", // must not match the "navi" entry
	} {
		if got := UncoveredInsurer(q); got != "" {
			t.Fatalf("%q was refused as %q", q, got)
		}
	}
}

func has(tags []string, want string) bool {
	for _, t := range tags {
		if t == want {
			return true
		}
	}
	return false
}

func TestTidyKeepsTheTrailingOptionRunFlushSoItBecomesChips(t *testing.T) {
	// One turn can answer an off-script question and re-ask the funnel question with its
	// choices. Indenting those choices leaves the visitor a bare keyboard mid-funnel, which is
	// what the first run of this actually did.
	got := tidyH("Care Supreme covers day care procedures.\n\nWho would the cover be for?\n" +
		"- Just me\n- Me and my spouse\n- My parents")
	flush := 0
	for _, line := range strings.Split(got, "\n") {
		if strings.HasPrefix(line, "- ") {
			flush++
		}
	}
	if flush != 3 {
		t.Fatalf("%d of 3 option lines stayed flush:\n%s", flush, got)
	}
}

func TestTidyIndentsAProseListEvenWithOptionsAfterIt(t *testing.T) {
	// The list inside the explanation must be indented; only the trailing run is a menu.
	got := tidyH("It covers:\n- day care\n- AYUSH\n\nWho would the cover be for?\n- Just me\n- My parents")
	lines := strings.Split(got, "\n")
	var flush []string
	for _, line := range lines {
		if strings.HasPrefix(line, "- ") {
			flush = append(flush, line)
		}
	}
	if len(flush) != 2 || flush[0] != "- Just me" {
		t.Fatalf("wrong lines kept flush %q:\n%s", flush, got)
	}
	if !strings.Contains(got, "  - day care") {
		t.Fatalf("the prose list was not indented:\n%s", got)
	}
}

func TestTidyIndentsALoneDashedLine(t *testing.T) {
	// One "option" is far more likely to be a sentence that happens to start with a dash, and
	// the panel would not render it as a chip either.
	got := tidyH("The cover has one exclusion.\n- cosmetic surgery")
	if strings.Contains(got, "\n- cosmetic") {
		t.Fatalf("a lone dashed line was left flush:\n%s", got)
	}
}

func TestTidyStripsTheModelsHardBreaks(t *testing.T) {
	// Two trailing spaces is a markdown hard break: it renders as nothing here, and it pushes an
	// option line past the parser's trailing-space tolerance.
	got := tidyH("Covered.  \nWho would the cover be for?  \n- Just me  \n- My parents  ")
	for _, line := range strings.Split(got, "\n") {
		if line != strings.TrimRight(line, " \t") {
			t.Fatalf("trailing whitespace survived: %q", line)
		}
	}
	if !strings.Contains(got, "\n- Just me\n") {
		t.Fatalf("option line not normalised:\n%s", got)
	}
}

// tidyH runs Tidy with the health funnel's first question as the offered menu, which is what the
// handler passes mid-funnel. The offered list is the only thing that separates a menu from a
// prose list, so it belongs in every Tidy case.
func tidyH(text string) string {
	return Tidy(text, Funnels["health"][0].Options)
}

func TestTidyIndentsEverythingWhenNoMenuWasOffered(t *testing.T) {
	// Past the funnel nothing is on offer, so a trailing dashed list is prose about plans and
	// must not become chips — which would delete it from the bubble.
	got := Tidy("Two options fit:\n- Care Supreme\n- Aspire", nil)
	for _, line := range strings.Split(got, "\n") {
		if strings.HasPrefix(line, "- ") {
			t.Fatalf("a list was left flush with no menu offered:\n%s", got)
		}
	}
}

func TestTidyIndentsAnInventedMenu(t *testing.T) {
	// The workflow's QA step fails a turn for inventing an option. A choice we never offered is
	// not a choice, so it does not get to look like one.
	got := Tidy("Who would the cover be for?\n- My whole village\n- My employer's group scheme",
		Funnels["health"][0].Options)
	for _, line := range strings.Split(got, "\n") {
		if strings.HasPrefix(line, "- ") {
			t.Fatalf("invented options were left flush:\n%s", got)
		}
	}
}

func TestTidyKeepsAMenuWithOneRewordedLabel(t *testing.T) {
	// Two matches are enough. Breaking the run in the middle would hand the panel a partial
	// menu, which reads worse than one reworded chip.
	got := Tidy("Who would the cover be for?\n- Just me\n- Me and my spouse\n- Me, my wife and kids",
		Funnels["health"][0].Options)
	flush := 0
	for _, line := range strings.Split(got, "\n") {
		if strings.HasPrefix(line, "- ") {
			flush++
		}
	}
	if flush != 3 {
		t.Fatalf("%d of 3 lines stayed flush:\n%s", flush, got)
	}
}

func TestOfferedOptionsFollowsTheFunnel(t *testing.T) {
	if got := OfferedOptions("", nil); len(got) != 6 || got[0] != "Health" {
		t.Fatalf("router options %q", got)
	}
	if got := OfferedOptions("health", nil); len(got) != 5 || got[0] != "Just me" {
		t.Fatalf("first health question's options %q", got)
	}
	// An open question has no list, and offering one would invent it.
	history := []Message{}
	for _, q := range Funnels["health"][:4] {
		history = append(history,
			Message{Role: "assistant", Content: Ask(q, "")},
			Message{Role: "user", Content: "yes"})
	}
	if got := OfferedOptions("health", history); len(got) != 0 {
		t.Fatalf("the open city question offered %q", got)
	}
}

func TestCapCutsAtANewlineSeparatedSentence(t *testing.T) {
	// A comparison is one dimension per line, so its sentences end ".\n" rather than ". ".
	// Matching only the space form cut those mid-word, which is what a cap exists to avoid.
	body := "Cover: " + strings.Repeat("a", 250) + ".\nEligibility: " + strings.Repeat("b", 250) +
		".\nRiders: Care Supreme offers a wellness benefit; Aspire offers a booster."
	got := Cap(body)
	if len([]rune(got)) > maxAnswerChars {
		t.Fatalf("cap not enforced: %d", len([]rune(got)))
	}
	if !strings.HasSuffix(got, ".") {
		t.Fatalf("cut mid-word: %q", got[len(got)-40:])
	}
}
