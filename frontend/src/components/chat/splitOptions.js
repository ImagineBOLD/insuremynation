/**
 * Splits an assistant reply into prose and its trailing option lines.
 *
 * The orchestrator presents choices as lines beginning with "- " at the end of a message:
 *
 *     Who would the cover be for?
 *
 *     - Just me
 *     - Me and my spouse
 *     - Family floater - me, spouse + kids
 *     - My parents
 *
 * This is a heuristic over generated text, so it is a progressive enhancement and every
 * guard below is load-bearing:
 *
 *   - **The last contiguous run of option lines**, not "the lines at the end". The
 *     integration guide's own parser walks up from the final line and stops at the first
 *     non-option — but the live opener ends with "You can also answer in your own words."
 *     *after* the list, so that version found nothing and chips never appeared. Taking a run
 *     from anywhere in the message handles prose on both sides of it.
 *   - **Two options minimum.** One "option" is far more likely to be a sentence that
 *     happens to start with a dash than a choice worth a chip.
 *   - **A blank line ends the run.** Conservative on purpose: two separate short lists are
 *     more likely to be prose than one menu.
 *   - **80 characters.** Beyond that it is prose, not a label, and it would not fit a chip.
 *   - **The dash must sit at column 0.** An indented dashed line is a nested fact under a
 *     label, not a choice. The bot now writes plan comparisons as a `Cover:` line followed by
 *     indented dashes; matching those turned every fact into a chip *and* deleted it from the
 *     body, leaving the visitor a bare label with its content gone. A real option list from
 *     the orchestrator is never indented, so requiring column 0 loses nothing. Trailing
 *     whitespace is still tolerated.
 *   - **A failed parse returns the message untouched**, chips absent. Never an error, and
 *     never a reply the visitor does not get to read.
 *
 * The caller must keep the composer available regardless: a visitor has to be able to type
 * "we are four in Gurgaon" rather than pick from a list. The chip sends its label as the
 * message text and the orchestrator normalises it, so "36 to 50" and "my dad is 47" land
 * the same way.
 */
// Dash at column 0, then at least one space, then a label that starts on a non-space and is
// captured lazily, so trailing whitespace — or a stray CR from \r\n — is tolerated without
// counting towards the 80. `\S` also keeps "-    " (a dash and nothing else) from parsing as
// a blank chip, which trimming used to rule out.
const OPTION = /^-[ \t]+(\S.{0,79}?)[ \t\r]*$/;

// Not trimmed on purpose: the left edge is the only thing separating an option from an
// indented fact.
const optionLabel = (line) => line.match(OPTION)?.[1] ?? null;

export function splitOptions(text) {
  const lines = String(text ?? '').split('\n');

  // Walk up for the last run of option lines. `end` is fixed by the first one found from
  // the bottom; `start` keeps moving while they stay contiguous.
  let start = -1;
  let end = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (optionLabel(lines[i]) !== null) {
      if (end === -1) end = i;
      start = i;
    } else if (end !== -1) {
      break; // the run ended — anything above belongs to the prose
    }
  }

  const options = end === -1 ? [] : lines.slice(start, end + 1).map(optionLabel);
  if (options.length < 2) return { body: text, options: [] };

  const body = [...lines.slice(0, start), ...lines.slice(end + 1)]
    .join('\n')
    // Removing the list from the middle leaves the blank lines that framed it back to back.
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { body, options };
}
