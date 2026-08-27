/**
 * Self-check for splitOptions, the one piece of real logic in the chat client.
 *
 *   node scripts/check-split-options.mjs
 *
 * It parses generated text, so it degrades silently: break it and chips simply stop
 * appearing, which nothing else would catch. There is no test framework in `frontend/`
 * and this does not need one — it runs the same way as export-kb.mjs and convert-images.mjs.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Vite resolves extensionless imports; node does not, and the module under test has no
// imports of its own, so loading it by path keeps this script dependency-free.
const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, '../src/components/chat/splitOptions.js'), 'utf8');
const { splitOptions } = await import(
  'data:text/javascript;base64,' + Buffer.from(src).toString('base64')
);

// The real opening message, verbatim from a live /widget-proxy/init response (run 5646).
// Two things here that the integration guide's example does not have, and both broke the
// parser as documented: a hyphen *inside* an option, and a line of prose *after* the list.
const opener = [
  'Thanks — noted.',
  '',
  'Who would the cover be for?',
  '- Just me',
  '- Me and my spouse',
  '- Family floater - me, spouse and kids',
  '- My parents',
  '',
  'You can also answer in your own words.',
].join('\n');

let r = splitOptions(opener);
assert.deepEqual(r.options, [
  'Just me',
  'Me and my spouse',
  'Family floater - me, spouse and kids',
  'My parents',
]);
assert.ok(r.body.includes('Who would the cover be for?'), 'prose before the list is kept');
assert.ok(r.body.endsWith('You can also answer in your own words.'), 'prose after it too');
assert.ok(!r.body.includes('- Just me'), 'options must not remain in the body');
assert.ok(!/\n{3,}/.test(r.body), 'the gap left by the list is collapsed');

// Trailing blank lines between the prose and the options, and after them.
r = splitOptions('Pick one:\n\n- 18 to 35\n- 36 to 50\n\n');
assert.deepEqual(r.options, ['18 to 35', '36 to 50']);
assert.equal(r.body, 'Pick one:');

// One option is not a menu — most likely a sentence that starts with a dash.
r = splitOptions('Almost done.\n- I will pass this to an adviser');
assert.deepEqual(r.options, []);
assert.equal(r.body, 'Almost done.\n- I will pass this to an adviser', 'body returned untouched');

// Prose that merely contains hyphens must not be mistaken for options.
r = splitOptions('Zero depreciation - full value on parts - is worth having.');
assert.deepEqual(r.options, []);

// Over 80 characters is prose, not a chip label. It breaks the run, so the single option
// above it is left under the two-option floor.
const long = '- ' + 'x'.repeat(81);
r = splitOptions(`Pick one:\n- Short\n${long}`);
assert.deepEqual(r.options, [], 'an over-long line breaks the run');

// Two short lists separated by a blank line: take the last run only, and never merge them.
r = splitOptions('First:\n- a\n- b\n\nThen:\n- c\n- d');
assert.deepEqual(r.options, ['c', 'd'], 'the last run wins');
assert.ok(r.body.includes('- a') && r.body.includes('- b'), 'the earlier list stays as prose');

// Indented dashes are nested facts, not choices. The bot writes plan comparisons this way,
// and treating them as options both stole the chips and deleted the facts from the body —
// the visitor was left with "Cover:" and nothing under it.
const nested = ['Cover:', '   - Care Supreme includes AYUSH', '   - Aspire adds an OPD benefit'].join('\n');
r = splitOptions(nested);
assert.deepEqual(r.options, [], 'indented dashed lines are not options');
assert.equal(r.body, nested, 'and the facts stay in the body, verbatim');

// Tabs indent too.
r = splitOptions('Cover:\n\t- one\n\t- two');
assert.deepEqual(r.options, [], 'a tab-indented run is not a menu either');

// Label-colon comparison lines, no dashes anywhere: straight through.
const compare = [
  'Care Supreme: room rent is uncapped, AYUSH included.',
  'Aspire: adds an OPD benefit and a lower waiting period.',
  'Optima Secure: doubles the sum insured from day one.',
].join('\n');
r = splitOptions(compare);
assert.deepEqual(r.options, []);
assert.equal(r.body, compare, 'a comparison passes through unchanged');

// Trailing whitespace after a real option is still an option (80 counts the label only).
r = splitOptions('Pick one:\n- Just me   \n- Me and my spouse\t');
assert.deepEqual(r.options, ['Just me', 'Me and my spouse']);

// An 80-character label is a chip; 81 is prose.
r = splitOptions(`Pick one:\n- ${'x'.repeat(80)}\n- Just me`);
assert.deepEqual(r.options, ['x'.repeat(80), 'Just me'], '80 characters still fits');
r = splitOptions(`Pick one:\n- ${'x'.repeat(81)}\n- Just me`);
assert.deepEqual(r.options, [], '81 breaks the run, leaving one option below the floor');

// Dashes with nothing after them are not blank chips.
r = splitOptions('Pick one:\n-   \n-\t');
assert.deepEqual(r.options, []);

// \r\n line endings: the CR must not end up inside the label.
r = splitOptions('Pick one:\r\n- Just me\r\n- My parents\r\n');
assert.deepEqual(r.options, ['Just me', 'My parents']);

// A mid-line dash inside a chip label survives as part of the label, and the same string as
// prose is not an option at all.
r = splitOptions('Who is it for?\n- Family floater - me, spouse and kids\n- Just me');
assert.deepEqual(r.options, ['Family floater - me, spouse and kids', 'Just me']);
r = splitOptions('Family floater - me, spouse and kids');
assert.deepEqual(r.options, [], 'a bare sentence with a dash is prose');
assert.equal(r.body, 'Family floater - me, spouse and kids');

// A plain answer with no options at all.
r = splitOptions('Our office is in Connaught Place, New Delhi.');
assert.deepEqual(r.options, []);
assert.equal(r.body, 'Our office is in Connaught Place, New Delhi.');

// Degenerate input must not throw — the panel renders whatever comes back.
for (const bad of ['', null, undefined]) {
  r = splitOptions(bad);
  assert.deepEqual(r.options, [], `no options for ${JSON.stringify(bad)}`);
}

console.log('splitOptions: all checks passed');
