/**
 * Self-check for unwrapEmphasis, the other silent failure in the chat client.
 *
 *   node scripts/check-emphasis.mjs
 *
 * The bubble has no markdown renderer on purpose, so a broken transform here does not throw:
 * the visitor just reads asterisks, or worse, loses a footnote marker. Same shape as
 * check-split-options.mjs — plain asserts, no framework.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, '../src/components/chat/unwrapEmphasis.js'), 'utf8');
const { unwrapEmphasis } = await import(
  'data:text/javascript;base64,' + Buffer.from(src).toString('base64')
);

// Paired emphasis is decoration; the words are the content.
assert.equal(unwrapEmphasis('**Cover**: text'), 'Cover: text');
assert.equal(unwrapEmphasis('__Cover__: text'), 'Cover: text');
assert.equal(
  unwrapEmphasis('**Care Supreme** covers AYUSH. **Aspire** adds OPD.'),
  'Care Supreme covers AYUSH. Aspire adds OPD.',
  'every pair in a line, not just the first'
);
assert.equal(unwrapEmphasis('**a**\n**b**'), 'a\nb', 'across lines, and the newline survives');

// A lone asterisk is a footnote marker in insurance copy and must reach the screen.
assert.equal(unwrapEmphasis('T&C apply*'), 'T&C apply*');
assert.equal(unwrapEmphasis('*Subject to underwriting'), '*Subject to underwriting');
assert.equal(unwrapEmphasis('Sum insured * 2'), 'Sum insured * 2');
assert.equal(unwrapEmphasis('a ** b'), 'a ** b', 'an unpaired ** is not emphasis');
assert.equal(unwrapEmphasis('** spaced **'), '** spaced **', 'a run must start on a non-space');

// Single-asterisk italics are left as they are: unwrapping them cannot be told apart from
// eating a footnote marker, and the model uses ** for the labels that actually matter.
assert.equal(unwrapEmphasis('*maybe italic*'), '*maybe italic*');

// The option lines splitOptions depends on must come through byte-identical.
const menu = 'Who would the cover be for?\n- Just me\n- Family floater - me, spouse and kids';
assert.equal(unwrapEmphasis(menu), menu, 'dashed option lines are untouched');

// Degenerate input must not throw — this runs on every bubble.
for (const [input, expected] of [
  ['', ''],
  [null, ''],
  [undefined, ''],
]) {
  assert.equal(unwrapEmphasis(input), expected, `safe for ${JSON.stringify(input)}`);
}

console.log('unwrapEmphasis: all checks passed');
