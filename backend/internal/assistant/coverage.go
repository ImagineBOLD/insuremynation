package assistant

// Insurers we do not place, checked by name before any model call.
//
// Ported from the corpus RAG's coverage.py, and the measurement that put it there still holds:
// similarity is the wrong instrument for this. "LIC Jeevan Anand policy details" scored 0.643
// and "Tata AIA term plan" 0.667, both above the in-domain floor — because they are fluent
// insurance questions, just about companies whose documents we never had. The worst failure
// this system can produce is a confident, well-cited answer about the wrong company.
//
// The catalogue's own insurance_catalog tool answers the same question, and the model is told to
// use it. This stays anyway: it is an exact check against a closed list, it costs nothing, and
// it fires before a token is spent. Agreeing to help with an insurer nobody here can service is
// a promise about a policy, not a wording slip.

import (
	"regexp"
	"sort"
	"strings"
)

// notCovered maps a name a customer plausibly types to the display name to refuse by. An empty
// value means the opposite: a former name of an insurer we DO place, which must fall through.
var notCovered = map[string]string{
	"lic": "LIC", "life insurance corporation": "LIC",
	"bajaj allianz": "Bajaj Allianz", "tata aia": "Tata AIA", "tata aig": "Tata AIG",
	"new india assurance": "The New India Assurance", "oriental insurance": "Oriental Insurance",
	"united india": "United India Insurance", "national insurance": "National Insurance",
	"sbi life": "SBI Life", "kotak life": "Kotak Life", "pnb metlife": "PNB MetLife",
	"canara hsbc": "Canara HSBC Life", "bharti axa": "Bharti AXA",
	"edelweiss tokio": "Edelweiss Tokio Life", "ageas federal": "Ageas Federal Life",
	"indiafirst": "IndiaFirst Life", "aviva": "Aviva India", "pramerica": "Pramerica Life",
	"shriram life": "Shriram Life", "star union": "Star Union Dai-ichi",
	"acko": "Acko", "navi": "Navi", "zuno": "Zuno General", "universal sompo": "Universal Sompo",
	"liberty general": "Liberty General", "magma hdi": "Magma HDI", "raheja qbe": "Raheja QBE",
	"chola ms": "Chola MS", "cholamandalam": "Chola MS", "iffco tokio": "IFFCO Tokio",
	"reliance nippon": "Reliance Nippon Life",

	// Former names of insurers we do place. Listed so a longest-first match on them wins over
	// the shorter uncovered name it contains — "reliance general" must not be refused because
	// "reliance nippon" exists, and "max bupa" must not trip anything at all.
	"max bupa": "", "aegon": "", "religare": "", "future generali": "",
	"reliance general": "", "kotak mahindra general": "", "cigna ttk": "",
}

var notCoveredKeys = func() []string {
	keys := make([]string, 0, len(notCovered))
	for k := range notCovered {
		keys = append(keys, k)
	}
	// Longest first, so "sbi life" wins over a bare "sbi" and "reliance nippon" over
	// "reliance general".
	sort.Slice(keys, func(i, j int) bool {
		if len(keys[i]) != len(keys[j]) {
			return len(keys[i]) > len(keys[j])
		}
		return keys[i] < keys[j]
	})
	return keys
}()

var nonWord = regexp.MustCompile(`[^a-z0-9 ]+`)
var spaceRun = regexp.MustCompile(`\s+`)

// UncoveredInsurer returns the display name of an insurer we do not place, if the text names
// one, or "" otherwise.
func UncoveredInsurer(text string) string {
	q := " " + spaceRun.ReplaceAllString(nonWord.ReplaceAllString(strings.ToLower(text), " "), " ") + " "
	for _, key := range notCoveredKeys {
		if strings.Contains(q, " "+strings.TrimSpace(key)+" ") {
			// "" is a former name of an insurer we do place: a hit, but not a miss.
			return notCovered[key]
		}
	}
	return ""
}
