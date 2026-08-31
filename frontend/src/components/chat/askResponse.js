/**
 * Turning one `/v1/ask` response into either a message or an error — and its citations into
 * lines a visitor can read.
 *
 * Its own module, with no imports, for two reasons: `node scripts/check-ask-response.mjs`
 * can load it the way the other checks load theirs, and the decision itself is the one
 * piece of new logic in the client that fails *silently*. Get it wrong and an escalation
 * renders as a red error box, or a real failure renders as an assistant answer.
 *
 * The rule that matters: **an `answer` is an answer whatever the status code.** The Go
 * proxy's own 502 and 503 bodies carry customer-safe wording plus `escalate: true`
 * (`backend/internal/handler/ask.go`), and `escalate` on a 200 is the assistant declining
 * to guess — which is a normal reply, not an error state. Only a response with no `answer`
 * at all is an error, which is what an upstream 401 from a wrong key looks like: the proxy
 * relays it verbatim, so it arrives without the `{answer, escalate}` shape.
 *
 * `phone` is passed in rather than imported so this stays dependency-free. It has to be the
 * same string as `PHONE` in `src/data/site.js`, because ChatPanel's ErrorNotice checks
 * whether the message already names the number before offering it a second time.
 */

export const GENERIC_ERROR = 'Something went wrong. Please try again.';
export const EMPTY_ANSWER = "I don't have an answer for that. Please try rephrasing.";

/**
 * Status → what the visitor reads.
 *
 * Two of these strings are load-bearing. The 429 text must contain "too many": ErrorNotice
 * matches on it to drop the "you can also call us" footer, because waiting is the actual
 * remedy there. And any text naming the number must use `phone` verbatim, or the notice
 * prints it twice.
 *
 * 404 sits with 403 rather than in the generic case: on a same-origin path it means the
 * deployed binary predates the proxy route, which for the visitor is the same fact as an
 * origin that is not allowlisted — the chat is not there, so give them the phone number.
 */
export function errorText(status, phone) {
  if (status === 403 || status === 404)
    return `Chat is unavailable on this page. Please call ${phone}.`;
  if (status === 429)
    return 'You have sent too many messages. Please wait a minute and try again.';
  if (status >= 500)
    return 'The assistant is unavailable right now. Please try again in a moment.';
  return GENERIC_ERROR;
}

/**
 * `{ answer, citations, escalate }` to render, or `{ error }` to show in place of the turn.
 *
 * Citations are normalised to an array here so nothing downstream has to guard: the
 * service omits the key entirely when it escalated, and a bubble should not have to know
 * that.
 *
 * `escalate` is passed through because it is the one signal that the assistant has stopped
 * being able to help, and it is what brings up the contact form. It arrives on a 200 (the
 * assistant declining to guess) as well as on the proxy's own 502/503 bodies. Read here rather
 * than in the hook, so one file knows the response shape.
 */
export function readAnswer(status, data, phone) {
  const escalate = Boolean(data?.escalate);
  const answer = typeof data?.answer === 'string' ? data.answer.trim() : '';
  if (answer) {
    return { answer, citations: Array.isArray(data.citations) ? data.citations : [], escalate };
  }
  // A 200 with nothing in it is not worth an error box — the visitor can just ask again.
  if (status === 200) return { answer: EMPTY_ANSWER, citations: [], escalate };
  return { error: errorText(status, phone) };
}

/**
 * One citation as a line of text: `Star Health · Medi Classic Prospectus`.
 *
 * The insurer has to be the prefix, because `doc_title` is whatever the PDF called itself and
 * half of them name nobody. Real ones from the corpus: "SALIENT FEATURES OF THE POLICY", and
 * "SBI General Insurance Company Limited     |     PROSPECTUS". The first is useless alone; the
 * second would say the insurer twice. So the title is whitespace-collapsed, stripped of a
 * leading repeat of the insurer, and cut at 64 characters — four of these sit under one bubble
 * and each should stay one line at 11px.
 */
export function citationLabel(c) {
  const who = prettyInsurer(c?.insurer);
  let what = String(c?.doc_title ?? '').replace(/\s+/g, ' ').trim();
  if (who && what.toLowerCase().startsWith(who.toLowerCase())) {
    what = what.slice(who.length).replace(/^[\s|·—–-]+/, '');
  }
  if (what.length > 64) what = `${what.slice(0, 63).trimEnd()}…`;
  return [who, what].filter(Boolean).join(' · ') || String(c?.doc_id ?? '');
}

/**
 * `star-health` → `Star Health`, `sbi-general` → `SBI General`.
 *
 * ponytail: a lookup of the acronyms that actually turn up in Indian insurer names, because
 * title-casing alone gives "Sbi General" and "Hdfc Ergo" on a page selling their policies.
 * Anything unlisted title-cases, which is right for the long tail. Add a slug when one shows up
 * wrong — no rule gets this right without a list.
 */
const ACRONYMS = new Set(['sbi', 'hdfc', 'icici', 'lic', 'aig', 'ergo', 'ms', 'hdi', 'qbe', 'iffco']);

export function prettyInsurer(slug) {
  return String(slug ?? '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}
