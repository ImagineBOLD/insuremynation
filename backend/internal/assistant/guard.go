package assistant

// The outgoing guardrail. Ported from the corpus RAG's guard.py and answer.py, which is where
// it used to live and where every one of these rules was learned the hard way.
//
// The contract, unchanged: no premiums, no rates, no waiting-period durations reach a customer.
// Benefit limits and sums insured are deliberately allowed — "the policy pays up to Rs 1 lakh"
// is what the cover does, and withholding it would make the assistant useless.
//
// Why any of this is needed when the catalogue holds no premiums and no durations by
// construction: the risk is not leaked source data any more, it is invention. A model writing
// for a customer paraphrases. The first live run of the RAG produced "Cover costs Rs 8,000 per
// annum" — no premium word anywhere in it — and "with a 2-year waiting period" out of chunks
// that were all individually clean. A rule that lives only in a prompt is a request; these run
// on the way out.

import (
	"regexp"
	"strings"
)

// The chat bubble is 14px text at 88% width (Message.jsx). Past roughly this length a visitor
// stops reading. Instructed in the prompt and then enforced here, because a cap that lives only
// in a prompt is a request.
const maxAnswerChars = 600

// Enforced classes. Anything outside this set is advisory and deliberately unenforced.
const (
	tagPremium = "premium_rate"
	tagWaiting = "waiting_period"
)

var (
	// From guard.py: document language, where a price sits next to the word "premium".
	// "premium" alone matched 44.8% of the corpus and is useless on its own.
	premiumWord = regexp.MustCompile(`(?i)\bpremium|\brate chart|\bper mille\b|\btariff\b`)
	moneyStrict = regexp.MustCompile(`(?i)(?:Rs\.?|INR|₹)\s*[\d,]{3,}|\b\d[\d,]{2,}(?:\.\d+)?\s*(?:/-|per annum|p\.a\.)`)
	pctRate     = regexp.MustCompile(`(?i)\b\d{1,3}(?:\.\d+)?\s*%\s*(?:of\s+)?(?:premium|sum insured|SI)\b`)
	waitingWord = regexp.MustCompile(`(?i)waiting[- ]period|pre[- ]existing\s+disease|\bPED\b|initial\s+waiting` +
		`|specific\s+illness|survival\s+period|moratorium\s+period|lock[- ]in\s+period`)

	// From answer.py: generated prose, where the model paraphrases instead.
	moneyAny = `(?:Rs\.?|INR|₹)\s*[\d,]+(?:\.\d+)?\s*(?:lakh|lakhs|crore|crores|k)?`
	// Deliberately not a bare "pay": "the policy pays up to ₹1 lakh" is a benefit limit, which
	// is quotable and useful. It is cost framing that is withheld, not every rupee figure.
	costWord = regexp.MustCompile(`(?i)\bcosts?\b|\bcosting\b|\bprices?\b|\bpriced\b|\bpricing\b|\bpremiums?\b` +
		`|\bcharges?\b|\bquoted?\b|\btariff\b|\bcheapest\b|\baffordab`)
	moneyLoose = regexp.MustCompile(moneyAny)
	priceProse = regexp.MustCompile(`(?i)` + moneyAny +
		`\s*(?:per annum|p\.a\.|per year|per month|a year|a month|annually|monthly)`)

	// "you must wait 24 months before claiming" says the same thing as "waiting period: 24
	// months" and shares none of its words. Spelled-out numbers count: a model writing for a
	// customer says "two years", not "24 months", and a digits-only pattern waves it through.
	nWord = `(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|` +
		`eighteen|twenty|thirty|forty|sixty|ninety)`
	durWord   = nWord + `[- ]?(?:day|days|month|months|year|years)`
	waitProse = regexp.MustCompile(`(?i)` +
		`\b(?:wait|waits|waiting)\b[^.]{0,40}?\b` + durWord + `\b` +
		`|\b` + durWord + `\b[^.]{0,25}?\b(?:wait|waits|waiting)\b` +
		`|\b` + durWord + `\b[^.]{0,30}?\bbefore\b[^.]{0,20}?\b(?:claim|claims|claiming|eligible)\b` +
		`|\b` + durWord + `\b[^.]{0,20}?\bof\s+continuous\s+(?:cover|coverage|membership|insurance)\b` +
		// ...and the same thing with the duration trailing: "continuous maternity coverage for
		// 24 months", which is how it actually came out of the live run.
		`|\bcontinuous\b[^.]{0,30}?\b(?:cover|coverage|membership|insurance)\b[^.]{0,20}?\b` + durWord + `\b` +
		// "covered after 24 months" is a waiting period; "the bonus increases after 2 years" is
		// not, so the verb list stays closed rather than matching any "after <duration>".
		`|\b(?:covered|cover|eligible|available|payable|claimable|admissible)\b[^.]{0,15}?` +
		`\bafter\b[^.]{0,15}?\b` + durWord + `\b`)

	// ponytail: every ** and __ goes, not just paired ones. RE2 has no backreference, so the
	// faithful port of answer.py's paired match would need a hand-written scanner — and the
	// goal is only "no emphasis markers in a bubble that renders text". No insurance answer
	// legitimately contains either sequence, so there is nothing to protect.
	emphasis     = regexp.MustCompile(`\*\*|__`)
	strayHeading = regexp.MustCompile(`(?m)^#{1,6}\s*`)
	flushDash    = regexp.MustCompile(`^-[ \t]+\S`)
	blankRun     = regexp.MustCompile(`\n{3,}`)

	// splitOptions.js's own OPTION pattern, so what Tidy preserves and what the panel claims
	// cannot drift apart: dash at column 0, then a label starting on a non-space, at most 80
	// characters — beyond that it is prose, not something that fits a chip.
	optionLine = regexp.MustCompile(`^-[ \t]+\S.{0,79}$`)
)

// Leaked returns the restricted classes present in generated prose. Empty means safe to send.
//
// This is the union of the index-time classifier and the paraphrase patterns. The classifier
// half still matters on generated text: an answer that says "waiting period" at all is one
// where the model has decided to discuss durations, and that is the turn to hand to a
// specialist rather than the turn to trust.
func Leaked(text string) []string {
	var tags []string
	if text == "" {
		return tags
	}
	premium := (premiumWord.MatchString(text) && (moneyStrict.MatchString(text) || pctRate.MatchString(text))) ||
		dense(text) ||
		priceProse.MatchString(text) ||
		(costWord.MatchString(text) && moneyLoose.MatchString(text))
	if premium {
		tags = append(tags, tagPremium)
	}
	if waitingWord.MatchString(text) || waitProse.MatchString(text) {
		tags = append(tags, tagWaiting)
	}
	return tags
}

// dense separates rate charts (~0.60 digits) from prose (~0.05), and catches an unlabelled
// premium table the keyword rule misses. It needs enough text to be meaningful: on a six-character
// fragment the ratio is noise.
func dense(text string) bool {
	if len(text) < 200 {
		return false
	}
	digits := 0
	for _, r := range text {
		if r >= '0' && r <= '9' {
			digits++
		}
	}
	return float64(digits)/float64(len([]rune(text))) > 0.25
}

// Tidy makes an answer safe for the chat bubble, which renders text and not markup.
//
// The awkward part is the dashes, and it is worth stating why, because the naive version of this
// shipped and broke the funnel. splitOptions.js turns the **last contiguous run** of two or more
// column-0 "- " lines into clickable chips and removes those lines from the body. Two opposite
// things follow:
//
//   - A dashed list inside an explanation must be indented, or the parser eats it: the visitor
//     loses the content and gets a menu where there is none.
//   - The funnel's own choices must stay flush, or they never become chips — and here, unlike in
//     the RAG, one turn can be both. The model answers an off-script question and re-asks the
//     current question with its choices in the same message, which is the whole point of the
//     change. Indenting everything left the visitor a bare keyboard mid-funnel.
//
// Text alone cannot tell the two apart — "It covers:" over two dashed lines looks exactly like a
// menu — so this does not guess. The caller passes the options it actually asked for, and only a
// trailing run that matches them stays flush. That also catches an invented option, which the
// workflow's own QA step fails a turn for: a choice we never offered is not a choice.
func Tidy(text string, offered []string) string {
	text = emphasis.ReplaceAllString(text, "")
	text = strayHeading.ReplaceAllString(text, "")

	lines := strings.Split(text, "\n")
	for i, line := range lines {
		// The model writes markdown hard breaks — two trailing spaces — which render as
		// nothing and push an option line past the parser's own trailing-space tolerance.
		lines[i] = strings.TrimRight(line, " \t\r")
	}
	keepFrom, keepTo := menuRun(lines, offered)
	for i, line := range lines {
		if i >= keepFrom && i <= keepTo {
			continue
		}
		if flushDash.MatchString(line) {
			lines[i] = "  " + line
		}
	}

	return strings.TrimSpace(blankRun.ReplaceAllString(strings.Join(lines, "\n"), "\n\n"))
}

// menuRun finds the trailing run of option lines and decides whether it is the menu we offered.
//
// Finding the run mirrors splitOptions.js: walk up from the bottom, stop at the first non-option
// after one has been seen, and require at least two — one "option" is far more likely to be a
// sentence that happens to start with a dash, and the panel would not render it as a chip either.
//
// The run is kept whole or indented whole, never split. Two matches are enough to call it: a
// model that reworded one label of five has still written the menu, and breaking the run in the
// middle would hand the panel a partial one, which reads worse than a reworded chip. The
// composer stays available either way, so a visitor is never trapped by the labels on offer.
func menuRun(lines []string, offered []string) (int, int) {
	if len(offered) == 0 {
		return -1, -1
	}
	start, end := -1, -1
	for i := len(lines) - 1; i >= 0; i-- {
		if optionLine.MatchString(lines[i]) {
			if end == -1 {
				end = i
			}
			start = i
		} else if end != -1 {
			break
		}
	}
	if start == -1 || end-start+1 < 2 {
		return -1, -1
	}

	want := make(map[string]bool, len(offered))
	for _, o := range offered {
		want[normalizeLabel(o)] = true
	}
	matched := 0
	for _, line := range lines[start : end+1] {
		if want[normalizeLabel(strings.TrimLeft(line, "- \t"))] {
			matched++
		}
	}
	if matched < 2 {
		return -1, -1
	}
	return start, end
}

// normalizeLabel compares a written option to an offered one the way a reader would: case and
// surrounding punctuation are noise, the words are the choice.
func normalizeLabel(s string) string {
	return strings.ToLower(strings.Trim(strings.TrimSpace(s), ".,;:!? \t"))
}

// Cap trims to maxAnswerChars at a sentence end, so the answer still reads as finished rather
// than truncated. A cut too near the start would leave a stub, so that falls back to a hard
// trim of the whole allowance.
func Cap(text string) string {
	if len([]rune(text)) <= maxAnswerChars {
		return text
	}
	runes := []rune(text)
	cut := string(runes[:maxAnswerChars])
	// Any sentence end followed by whitespace, not just ". ". A comparison is one dimension per
	// line, so its sentences end ".\n" — matching only the space form cut those mid-word, which
	// is exactly what a cap is supposed to avoid.
	stop := -1
	for i, r := range cut {
		if r != '.' && r != '!' && r != '?' {
			continue
		}
		rest := cut[i+1:]
		if rest == "" || rest[0] == ' ' || rest[0] == '\n' || rest[0] == '\t' || rest[0] == '\r' {
			stop = i
		}
	}
	if stop > len(cut)/3 {
		return strings.TrimSpace(cut[:stop+1])
	}
	return strings.TrimSpace(cut)
}
