/**
 * Self-check for the contact-ask detector.
 *
 *   node scripts/check-contact-ask.mjs
 *
 * The detector reads imagine.bo's generated prompt, which is theirs to reword. When it stops
 * matching, nothing breaks and nothing complains — the visitor just gets a keyboard where a
 * form should be, which is invisible unless someone happens to walk the funnel. This pins the
 * live wording so a reword surfaces here instead.
 *
 * The strings below are verbatim from a real conversation on the bike page.
 *
 * **Half of this is dormant.** The site no longer calls imagine.bo, so the prose those
 * strings came from will not arrive again and `isContactAsk` is never true in the running
 * app — a green run here is not coverage of anything live. Do not read it as one, and do not
 * delete it either: rebuilding the contact ask on our side is the next change, and the
 * `formatContact` and `contactError` cases below cover code `ContactForm.jsx` still imports
 * and still runs the moment that form is shown again.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, '../src/components/chat/contactAsk.js'), 'utf8');
const { isContactAsk, formatContact, contactError } = await import(
  'data:text/javascript;base64,' + Buffer.from(src).toString('base64')
);

// --- the real ask -------------------------------------------------------------------------
const ASK = [
  'Before we start, let me take your details so a counsellor can follow up properly - and so nothing is lost if we get disconnected.',
  'Your name, the best mobile number, and your email?',
  'By sharing these, you agree that InsureNation may contact you about this enquiry. We never make marketing calls.',
  'Then a few quick questions and I will have everything the counsellor needs.',
].join('\n');
assert.equal(isContactAsk(ASK), true, 'must fire on the live contact ask');

// Without the consent line it still has to fire: all three are asked for, and it is a question.
assert.equal(
  isContactAsk('Your name, the best mobile number, and your email?'),
  true,
  'the three-in-one question alone is enough'
);
// And the consent line alone is enough, in case the question is reworded around it.
assert.equal(
  isContactAsk('So a counsellor can call you back: by sharing these, you agree that InsureNation may contact you.'),
  true,
  'the consent sentence alone is enough'
);

// --- every other turn in the funnel ---------------------------------------------------------
const NOT = {
  opener: [
    "Hi! I'm the InsureNation assistant.",
    'Happy to help you with bike cover — we recommend customised policies with the add-ons that genuinely apply to how and where the bike is ridden.',
    'What kind of bike is it?',
    '- Commuter',
    '- 150-500cc',
    '- Superbike',
  ].join('\n'),
  acknowledgement: 'Thanks, Rahul!\n\nWhere are you with the policy right now?',
  callback: [
    'So: a family floater for you, your spouse and kids, eldest 36 to 50, in Delhi NCR, around 10 lakh cover.',
    '',
    'Would you like an adviser to call you back?',
  ].join('\n'),
  handover: 'You can use the quote form on this page, or call us on +91 99101 69789.',
  // Mentions a name and a number, asks for neither.
  summary: 'Noted: your name is on the enquiry and the mobile number ends 2345. Which city are you in?',
};
for (const [label, text] of Object.entries(NOT)) {
  assert.equal(isContactAsk(text), false, `must NOT fire on the ${label} turn`);
}

// A turn that offers choices is a funnel question even if it says the words.
assert.equal(
  isContactAsk('Your name, mobile and email?\n- Yes\n- No'),
  false,
  'option lines mean it is a funnel question, not the contact ask'
);

// Degenerate input must not throw.
for (const bad of ['', '   ', null, undefined]) {
  assert.equal(isContactAsk(bad), false, `no match for ${JSON.stringify(bad)}`);
}

// --- the message that gets sent --------------------------------------------------------------
assert.equal(
  formatContact({ name: 'Rahul Sharma', dial: '+91', phone: '9876543210', email: 'u@example.com' }),
  'Rahul Sharma\n+91 9876543210\nu@example.com',
  'plain three-line message — WhatsApp permission is the workflow turn, not this form'
);
assert.equal(
  formatContact({ name: 'Rahul Sharma', dial: '+91', phone: '9876543210', email: '  ' }),
  'Rahul Sharma\n+91 9876543210',
  'the email line is dropped when blank — their funnel does not chase it'
);
assert.equal(
  formatContact({ name: ' Nehal ', dial: '+971', phone: ' 501234567 ', email: '' }),
  'Nehal\n+971 501234567',
  'fields are trimmed and the dial code always leads the number'
);

// --- validation ------------------------------------------------------------------------------
const ok = { name: 'Rahul', dial: '+91', phone: '9876543210', email: '' };
assert.equal(contactError(ok), null, 'a valid Indian number passes');
assert.match(contactError({ ...ok, name: ' ' }), /name/i);
assert.match(contactError({ ...ok, phone: '' }), /mobile/i);
assert.match(contactError({ ...ok, phone: '966701234' }), /10 digits/, 'short Indian number');
assert.match(contactError({ ...ok, phone: '1234567890' }), /6, 7, 8 or 9/, 'bad Indian prefix');
assert.equal(contactError({ ...ok, phone: '96670 12345' }), null, 'spaces in the number are fine');
assert.equal(contactError({ ...ok, dial: '+971', phone: '501234567' }), null, 'non-Indian numbers only need a sane length');
assert.match(contactError({ ...ok, dial: '+971', phone: '123' }), /check the mobile/i);
assert.match(contactError({ ...ok, email: 'nope' }), /email/i);
assert.equal(contactError({ ...ok, email: 'a@b.co' }), null, 'a well-formed email passes');

console.log('contactAsk: all checks passed');
