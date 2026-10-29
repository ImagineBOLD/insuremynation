/**
 * Emits the chatbot's knowledge-base corpus from the site's own copy.
 *
 *   node scripts/export-kb.mjs            # write kb-corpus.txt
 *   node scripts/export-kb.mjs --stdout   # print instead
 *
 * The point of generating rather than hand-writing it: the copy in
 * `src/data/products.js` is the source of truth and it changes. Re-run this after
 * any copy edit and re-ingest, and the assistant cannot drift from what the site
 * actually says.
 *
 * Note that the website chat does NOT read this file, and there is no longer
 * anything in this repo that does. The assistant is the Dograh workflow, whose
 * ground truth about the firm is its own `globalNode` persona block and whose plan
 * facts come from the plan-catalogue MCP service — both on imagine.bo's side. So a
 * copy edit here reaches other consumers of this export, not the panel on this
 * site, and the matching edit is one nobody in this workspace can make: ask
 * whoever owns the workflow to update the persona and re-ingest.
 *
 * That sentence has now been rewritten three times, each time naming wherever the
 * assistant's identity currently lives. It has moved on every one of those
 * occasions, which is the reason to keep saying it out loud rather than assuming.
 *
 * Whatever does ingest this is instructed to answer only from it and never to
 * invent policy details, prices or coverage terms, so anything absent here is
 * something it will decline to answer. That is intended: this is marketing copy,
 * not a policy wording.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PRODUCTS } from '../src/data/products.js';
import { EMAIL, EXPERT_COPY, PHONE, WHATSAPP } from '../src/data/site.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const out = [];
const section = (title) => out.push('', `## ${title}`, '');
const line = (s) => out.push(s);

line('# InsureMyNation — website reference');
line('');
line(
  'InsureMyNation (also written InsureNation) is a boutique insurance advisory firm ' +
    'in New Delhi, India. It advises on and places health, life, car, bike, travel ' +
    'and marine insurance, and runs a support desk for claims and mis-selling ' +
    'disputes. This document is the copy published on its website.'
);

// The assistant's own identity is NOT defined here — it lives in the workflow's
// `globalNode` persona block, which every channel is now held to, the website
// included. Not here because retrieval is semantic and a question like "what are you"
// does not reliably pull whichever chunk describes the bot. What stays here is the
// third-person scope note: useful if a visitor asks in a roundabout way that does
// retrieve, and harmless if it never does.
section('Scope of this document');
line(
  'This document is the copy published on the InsureNation website: what the firm ' +
    'does, the cover it advises on, its team, its careers and how to contact it. It is ' +
    'marketing and service copy, not a policy wording — the binding terms of any ' +
    'policy are always the insurer\'s own document.'
);
line('');
line(
  'It does not contain premiums or prices, eligibility decisions for any individual, ' +
    'or the terms of a specific customer\'s policy. Those need a counsellor, who can be ' +
    'reached on the phone number and email below.'
);

for (const product of Object.values(PRODUCTS)) {
  const name = product.hero.title.join(' ').trim();
  section(`${name} (${product.slug})`);

  line(`Summary: ${product.hero.sub}`);
  line('');
  line(`Why it matters — ${product.why.heading.join(' ')}:`);
  for (const p of product.why.paragraphs) line(`- ${p}`);

  line('');
  line('What you get:');
  for (const perk of product.perks) line(`- ${perk.title}: ${perk.sub}`);

  line('');
  line(`${product.cover.heading.join(' ')}: ${product.cover.intro}`);
  line('');
  line('Cover includes:');
  for (const item of product.cover.items) line(`- ${item}`);

  line('');
  line(
    `To get a quote for this product the website asks for: ` +
      `${product.fields.map((f) => f.label).join(', ')}.`
  );
}

// ---------------------------------------------------------------------------
// Page copy.
//
// products.js above is imported, so it can never drift. The blocks below are
// transcribed from the page components, which hold their copy inline in JSX —
// there is nothing importable to read. Every line is copied verbatim from the
// source; the regulatory registration, the office address and the team titles
// were each checked against the file rather than retyped from memory, because a
// chatbot stating a wrong IRDAI number or a wrong address is worse than one that
// declines to answer.
//
// If you edit the copy on a page, update the matching block here and re-ingest.
// ---------------------------------------------------------------------------

section('About InsureNation');
for (const l of [
  'A boutique insurance firm. We help people protect their lives and their lifestyle - with a special focus on the HNI segment and end-to-end insurance solutions.',
  'Our team has spent careers distributing health insurance, life insurance, mutual funds and banking products at HDFC Bank, Niva Bupa, HDFC Life and Nippon Asset Management - more than 45 years of combined experience serving high-net-worth clients across insurance and wealth management, with customer service as the core focus area.',
  'We are founder members of Niva Bupa Direct Sales. Having built profitable businesses in leadership roles across direct-sales distribution, we work customer-first: the right product recommended only after a proper analysis of your needs and requirements.',
  'We came together as a team so we could offer a genuinely differentiated experience for every insurance and wealth requirement you bring us.',
]) {
  line(l);
  line('');
}
line('Credentials:');
for (const l of [
  '45+ years of combined team experience',
  'Founder members of Niva Bupa Direct Sales',
  'HNI specialists in insurance & wealth advisory',
  'IRDAI Registered Direct Broker, registration IRDAI/DB 1093/2023',
]) {
  line(`- ${l}`);
}
line('');
line(
  'Vision: to become an easily accessible, service-oriented insurance advisory firm in India.'
);
line(
  "Mission: to help people protect their lifestyle through education of insurance needs, and facilitation of the right insurance products to the customer's satisfaction."
);
line('');
line('How the firm works:');
for (const l of [
  'Protection products - cover recommended on need, never on commission',
  'Technology - digital journeys for quotes, issuance and renewals',
  'Customer first - advice before the sale, service long after it',
  'Relationship management - one manager who stays with you year after year',
]) {
  line(`- ${l}`);
}

section('Leadership team');
for (const l of [
  'Nehal Kumar, Co-Founder & Chief Executive. MBA from IMT Ghaziabad and 19+ years as a retail financial professional. A founder member of Niva Bupa (formerly Max Bupa Health Insurance), he has also worked with HDFC Bank, Nippon AMC and Kotak Mahindra Bank. He was instrumental in building a profitable HNI-focused direct sales distribution with customer service at its core. An avid photographer who keeps a learning attitude towards life.',
  'Parvesh Kumar, Co-Founder & Chief Business Officer. 15+ years of leadership in health and life insurance. As a founder member of direct sales distribution at Niva Bupa, he delivered profitable growth through large team management, P&L ownership and HNI relationship management. Previously with Aviva and MetLife. B.Com from Delhi University and a passionate cricketer.',
  'Deepak Kr Sharma, Business Head - Health Insurance. 7+ years in insurance - life cover at HDFC Life, then health insurance expertise at Niva Bupa, where he played a big role in the success of direct sales. He believes recommending solutions based on a person’s actual needs is the key to relationship management. B.Com from Delhi University.',
  'Anubhav Adya, Business Head - Direct Sales. 6+ years in health insurance. A founder member of the Any Time Health initiative at CyberHub for Niva Bupa - an industry-first digital sales and service machine - and helped build point-of-care touchpoints in hospitals. His expertise is HNI relationship management. Graduate of IP University and a massive cricket buff.',
]) {
  line(`- ${l}`);
  line('');
}

section('Customer reviews published on the site');
for (const l of [
  'Varun Yaul (health insurance): The team, especially Swati, helped me find the health plan that actually suited my need - and ported my existing plan when the other insurer’s renewal team wouldn’t help. I recommend InsureNation for anything insurance related.',
  'Ritu Sharma (claim support): Aman guided us through the entire claim process smoothly and professionally. The company gave quick support and handled the claim efficiently, which made the whole experience stress-free.',
  'Vasantharaj Rajendran (health insurance): I have had good support from my relationship manager Yashika from day one - choosing the right policy and riders, and till date clarifying any query I have. Thank you for the continued support.',
]) {
  line(`- ${l}`);
}

section('Careers');
line(
  'A boutique insurance firm in Connaught Place, looking for energetic people with a can-do attitude and leadership instincts.'
);
line('');
line(
  'If you are looking for a career in insurance and want the chance to learn from people who have spent decades in it, we welcome you with open arms - experienced or fresher. Every open role sits in our Connaught Place office in New Delhi, works directly with senior counsellors, and carries an incentive structure with monthly rewards and recognition.'
);
line('');
line('Open roles, both full time and both in Connaught Place, New Delhi:');
for (const l of [
  'Health Insurance Counsellor - drive business through existing customers and data calling. Experience in insurance tele-sales or field sales preferred. Qualification: senior secondary, graduate or fresher.',
  'Telecaller - interact with and drive business from our customers through tele-calling, and generate references. Experience in insurance tele-sales or field sales preferred. Qualification: senior secondary, graduate or fresher.',
]) {
  line(`- ${l}`);
}
line('');
line(
  'Both roles offer attractive remuneration, incentives, and monthly rewards and recognition. To apply, use the form on the careers page: pick the role, tell us a little about yourself and attach a CV (PDF, JPG, JPEG or DOCX, up to 5 MB). Every application is read by a person, and we reply either way.'
);

section('Talking to an adviser');
line(EXPERT_COPY);
line('');
line(`Phone: ${PHONE}`);
line(`Email: ${EMAIL}`);
line(`WhatsApp: ${WHATSAPP}`);
line('');
line(
  'The firm is boutique, so there is no ticket queue — enquiries are answered the ' +
    'same working day, and the quote forms on the site promise a callback within one ' +
    'working day.'
);

// Same address as src/data/site.js (ADDRESS), which the footer, Contact page and
// Privacy Policy all show. The site once also showed "1015-1016, Ambadeep
// Building, 14 Kasturba Gandhi Marg" on the Contact page; that was retired.
section('Visiting the office');
line(
  '808, Arunachal Building, Barakhamba Road, Connaught Place, New Delhi 110001. Nearest metro: Barakhamba Road.'
);
line('');
line('Office hours for walk-ins:');
for (const l of [
  'Monday to Friday, 10:00 am to 7:00 pm',
  'Saturday, 10:00 am to 4:00 pm',
  'Sunday, closed',
]) {
  line(`- ${l}`);
}
line('');
line(
  'Phone lines are open Monday to Saturday, 10 am to 7 pm IST. Email is welcome for policy documents and claim papers, and WhatsApp is quickest for quotes and quick questions.'
);
line('');
line(
  'Call, write or walk into the Connaught Place office. An insurance counsellor - not a call centre script - takes it from there. Whether you are comparing plans for the first time, adding a family member to an existing policy, or chasing an insurer on a claim, the same team handles it end to end. The enquiry form asks what the message is about (new policy, renewal, claim support or careers), your name, mobile number, email and message. No marketing calls, ever.'
);

section('Claims and mis-selling support');
line(
  'InsureNation runs a support desk for policyholders in dispute with an insurer, ' +
    'whether or not the policy was bought through the firm. Complaints most often ' +
    'surface at the worst moment — at the time of a claim, when an illness or a loss ' +
    'is already being dealt with.'
);
line('');
line('The desk handles:');
for (const s of [
  'Mis-sold policies — a plan that never matched what was described, established in writing',
  'Claims sitting past the regulatory turnaround time, which get escalated',
  'Rejected claims — the repudiation letter is read and a case built for review',
  'Lapsed policies — revived with the least penalty possible',
  'Documentation, follow-ups and insurer coordination handled on the customer’s behalf',
  'Declined at underwriting — finding an insurer who will offer cover',
]) {
  line(`- ${s}`);
}
line('');
line(
  'Industry experts handhold the customer through the process to a satisfactory ' +
    'resolution.'
);
line('');
line(
  'A policy is only as good as the claim it pays. If an insurer has delayed, rejected or mis-sold, our industry experts take the case up on your behalf. To raise a case, tell us what happened in a few lines and keep the policy number and any letters from the insurer handy - a counsellor will call to collect the documents and set out the next steps. Your details stay with our claims desk, and there are no marketing calls.'
);

const text = out.join('\n') + '\n';

if (process.argv.includes('--stdout')) {
  process.stdout.write(text);
} else {
  const target = path.join(root, 'kb-corpus.txt');
  await writeFile(target, text, 'utf8');
  console.log(`${target}  (${text.length} chars, ${text.split('\n').length} lines)`);
}
