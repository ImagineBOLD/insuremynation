/**
 * Strips paired markdown emphasis out of an assistant reply, leaving the words behind.
 *
 * The bubble renders text, not markup (`Message.jsx`), and that is deliberate: replies are
 * model output built from retrieved documents, so an HTML path would run the knowledge base
 * through the DOM. But the model writes `**Cover**: …` anyway, and with no renderer the
 * visitor reads the asterisks. Unwrapping is the whole fix — the emphasis is decoration, the
 * words are the content.
 *
 * Deliberately not a markdown library:
 *   - it would be a dependency for one transform, and
 *   - it would turn the orchestrator's `- ` lines into an HTML list, which is exactly the
 *     shape `splitOptions.js` parses out of the text — the panel would lose its chips.
 *
 * Only **paired** delimiters are unwrapped. Insurance copy ends sentences with a footnote
 * marker ("T&C apply*"), and a lone asterisk must reach the screen intact; the same goes for
 * a `*` used as a bullet or a multiplication sign. `(?=\S)` and the trailing `\S` mean the
 * run has to start and end on a non-space, so `2 ** 3` and `a * b * c` are left alone too.
 */
const PAIRED = /(\*\*|__)(?=\S)([\s\S]*?\S)\1/g;

export function unwrapEmphasis(text) {
  return String(text ?? '').replace(PAIRED, '$2');
}
