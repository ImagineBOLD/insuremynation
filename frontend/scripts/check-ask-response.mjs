/**
 * Self-check for readAnswer, the piece of the chat client that decides whether a `/v1/ask`
 * response is an answer or a failure.
 *
 *   node scripts/check-ask-response.mjs
 *
 * It fails silently in both directions, which is why it is worth pinning. Read it too
 * strictly and an escalation — the assistant politely declining, with a phone number —
 * renders as a red error box. Read it too loosely and a real failure renders as an assistant
 * message, so a wrong API key looks like the bot having nothing to say.
 *
 * Same shape as check-split-options.mjs: plain asserts, no framework.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, '../src/components/chat/askResponse.js'), 'utf8');
const { readAnswer, errorText, citationLabel, prettyInsurer, EMPTY_ANSWER, GENERIC_ERROR } =
  await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));

const PHONE = '+91 99101 69789';

// The number the module is given has to be the number ChatPanel's ErrorNotice looks for, or
// the notice offers it a second time under the message that already contains it.
const site = readFileSync(path.join(here, '../src/data/site.js'), 'utf8');
assert.ok(
  site.includes(PHONE),
  `site.js no longer exports ${PHONE}; this script and ErrorNotice both assume it`
);

// ---------------------------------------------------------------- the four branches

// 1. An ordinary answer.
{
  const r = readAnswer(200, {
    answer: 'Yes, day care treatment is covered when it is medically necessary.',
    citations: [{ doc_id: 'a', doc_title: 'Care Health — Know Your Policy Better' }],
    escalate: false,
  }, PHONE);
  assert.equal(r.error, undefined);
  assert.match(r.answer, /^Yes, day care/);
  assert.equal(r.citations.length, 1);
}

// 2. An escalation is a normal message, not an error. This is the branch most likely to be
//    "simplified" into an error state by someone reading `escalate: true` as a failure.
{
  const r = readAnswer(200, {
    answer: `I am not able to answer that one. Please call ${PHONE} and a specialist will help.`,
    escalate: true,
  }, PHONE);
  assert.equal(r.error, undefined, 'escalate: true must still render as an assistant message');
  assert.deepEqual(r.citations, [], 'an escalation carries no citations, but must not be undefined');
}

// 3. The Go proxy's own 502/503 bodies carry customer-safe wording. Status is not the test —
//    the presence of an answer is.
{
  const r = readAnswer(502, {
    answer: `I could not reach our knowledge base just now. Please try again, or call ${PHONE}.`,
    escalate: true,
  }, PHONE);
  assert.equal(r.error, undefined, 'a 5xx that carries an answer is still an answer');
  assert.match(r.answer, /knowledge base/);
}

// 4. A wrong RAG_API_KEY: the proxy relays the upstream 401 verbatim, so it arrives with no
//    {answer, escalate} shape at all. This is the one that has to become an error.
{
  const r = readAnswer(401, { detail: 'Not authenticated' }, PHONE);
  assert.equal(r.answer, undefined);
  assert.equal(r.error, GENERIC_ERROR);
}

// ---------------------------------------------------------------- edges

// A 200 with nothing usable is not worth a red box.
assert.equal(readAnswer(200, {}, PHONE).answer, EMPTY_ANSWER);
assert.equal(readAnswer(200, null, PHONE).answer, EMPTY_ANSWER);
assert.equal(readAnswer(200, { answer: '   ' }, PHONE).answer, EMPTY_ANSWER);

// Citations are always an array, whatever the service sent.
assert.deepEqual(readAnswer(200, { answer: 'hi' }, PHONE).citations, []);
assert.deepEqual(readAnswer(200, { answer: 'hi', citations: null }, PHONE).citations, []);

// A non-string answer is not an answer.
assert.equal(readAnswer(200, { answer: 42 }, PHONE).answer, EMPTY_ANSWER);
assert.ok(readAnswer(500, { answer: 42 }, PHONE).error);

// ---------------------------------------------------------------- escalate passes through

// This is what brings up the contact form: an escalation means the assistant has said it cannot
// help and offered a callback, which is the one moment the form is wanted rather than
// interruptive. Dropped here — as it was until the contact ask was rebuilt — and the form has no
// trigger at all, which is the state in which the website produced zero CRM leads.
assert.equal(readAnswer(200, { answer: 'x', escalate: true }, PHONE).escalate, true);
assert.equal(readAnswer(200, { answer: 'x', escalate: false }, PHONE).escalate, false);
assert.equal(readAnswer(502, { answer: 'x', escalate: true }, PHONE).escalate, true);

// Always a boolean, never undefined: the hook keeps it in state and feeds it to a `&&` chain.
assert.equal(readAnswer(200, { answer: 'x' }, PHONE).escalate, false);
assert.equal(readAnswer(200, {}, PHONE).escalate, false);
assert.equal(readAnswer(200, null, PHONE).escalate, false);

// The scope answer — "what do you offer" — is what this branch was fixed for. It must read as a
// normal answer, not an escalation, or the form appears on the opening question.
assert.equal(
  readAnswer(200, { answer: 'We advise on health, life, car…', escalate: false, reason: 'scope' },
    PHONE).escalate,
  false
);

// ---------------------------------------------------------------- reason passes through

// `reason` is which stage the service answered from, and 'funnel' is a hard veto on the contact
// form: a turn-count trigger alone put the form up between "where are you with the policy" and
// "which car is it", asking for a number before the visitor had been shown anything. Contact
// comes last in this flow — the shortlist earns it.
assert.equal(readAnswer(200, { answer: 'x', reason: 'funnel' }, PHONE).reason, 'funnel');
assert.equal(readAnswer(200, { answer: 'x', reason: 'shortlist' }, PHONE).reason, 'shortlist');
assert.equal(readAnswer(200, { answer: 'x', reason: 'contact' }, PHONE).reason, 'contact');

// Null, never undefined — a document answer carries no stage, and the hook compares it directly.
assert.equal(readAnswer(200, { answer: 'x' }, PHONE).reason, null);
assert.equal(readAnswer(200, { answer: 'x', reason: 42 }, PHONE).reason, null);
assert.equal(readAnswer(200, null, PHONE).reason, null);

// ---------------------------------------------------------------- the shortlist's plans

// They used to be three names inside the sentence, separated by semicolons with the insurer in
// brackets — "not able to tell which is which". They are data now, and Message renders a card
// each; dropped here and the shortlist turn arrives as prose with no plans in it at all.
{
  const r = readAnswer(200, {
    answer: 'Here are three that look closest to what you described.',
    reason: 'shortlist',
    plans: [
      { plan_name: 'Digit Two-Wheeler Package Policy', insurer: 'Go Digit General Insurance', plan_type: 'Comprehensive' },
      { plan_name: 'Two Wheeler Insurance', insurer: 'HDFC ERGO General Insurance', plan_type: 'Comprehensive' },
    ],
  }, PHONE);
  assert.equal(r.plans.length, 2);
  assert.equal(r.plans[0].plan_name, 'Digit Two-Wheeler Package Policy');
  assert.equal(r.plans[0].plan_type, 'Comprehensive');
}

// Always an array, like citations — every non-shortlist turn sends [] and the panel maps over it
// without guarding.
assert.deepEqual(readAnswer(200, { answer: 'x' }, PHONE).plans, []);
assert.deepEqual(readAnswer(200, { answer: 'x', plans: null }, PHONE).plans, []);
assert.deepEqual(readAnswer(200, { answer: 'x', plans: 'nope' }, PHONE).plans, []);
assert.deepEqual(readAnswer(200, null, PHONE).plans, []);

// ---------------------------------------------------------------- error wording

// ErrorNotice drops its "you can also call us" footer when the message says to wait instead.
assert.match(errorText(429, PHONE), /too many/i, 'ErrorNotice matches /too many/i on this string');

// ...and when the message already names the number, so it is not printed twice.
assert.ok(errorText(403, PHONE).includes(PHONE));
assert.ok(errorText(404, PHONE).includes(PHONE), '404 means the proxy route is not deployed');

// A 5xx is worth retrying and says so; it must NOT contain the number, or the footer that
// offers email as well is suppressed for no reason.
assert.ok(!errorText(503, PHONE).includes(PHONE));
assert.match(errorText(500, PHONE), /try again/i);

// Anything unclassified falls through rather than inventing a reason.
assert.equal(errorText(418, PHONE), GENERIC_ERROR);
assert.equal(errorText(0, PHONE), GENERIC_ERROR);

// ---------------------------------------------------------------- citation labels

// Acronyms, because "Sbi General" and "Hdfc Ergo" on a page selling their policies is the whole
// reason there is a lookup rather than a title-case.
assert.equal(prettyInsurer('sbi-general'), 'SBI General');
assert.equal(prettyInsurer('hdfc-ergo'), 'HDFC ERGO');
assert.equal(prettyInsurer('star-health'), 'Star Health');
assert.equal(prettyInsurer('generali-central'), 'Generali Central');
assert.equal(prettyInsurer(''), '');
assert.equal(prettyInsurer(undefined), '');

// All four of these are verbatim from a live /v1/ask response.
assert.equal(
  citationLabel({ insurer: 'star-health', doc_title: 'STAR HEALTH AND ALLIED INSURANCE COMPANY LIMITED     |     PROSPECTUS' }),
  'Star Health · AND ALLIED INSURANCE COMPANY LIMITED | PROSPECTUS',
  'runs of whitespace collapse, and the repeated insurer comes off the front'
);
// Long enough to be cut, and cut at a whole character with an ellipsis rather than mid-word
// noise. 64 is what keeps four of these to one line each under a bubble.
{
  const long = citationLabel({ insurer: 'care-health', doc_title: 'A'.repeat(80) });
  assert.ok(long.endsWith('…'));
  assert.equal(long.length, 'Care Health · '.length + 64);
}
assert.equal(
  citationLabel({ insurer: 'generali-central', doc_title: 'SALIENT FEATURES OF THE POLICY' }),
  'Generali Central · SALIENT FEATURES OF THE POLICY',
  'a title that names nobody is exactly why the insurer is the prefix'
);
// The title already opens with the insurer, so it is not repeated.
assert.equal(
  citationLabel({ insurer: 'sbi-general', doc_title: 'SBI General Insurance Company Limited     |     PROSPECTUS' }),
  'SBI General · Insurance Company Limited | PROSPECTUS'
);
assert.equal(
  citationLabel({ insurer: 'care-health', doc_title: 'Care Health — Know Your Policy Better' }),
  'Care Health · Know Your Policy Better'
);

// Missing pieces degrade rather than render "undefined" at a visitor.
assert.equal(citationLabel({ insurer: 'lic' }), 'LIC');
assert.equal(citationLabel({ doc_title: 'Policy Wording' }), 'Policy Wording');
assert.equal(citationLabel({ doc_id: 'abc__def' }), 'abc__def');
assert.equal(citationLabel({}), '');
assert.equal(citationLabel(undefined), '');

console.log('check-ask-response: all checks passed');
