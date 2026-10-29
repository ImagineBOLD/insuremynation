import { ADDRESS, PHONE } from './site';

// Privacy Policy copy, transcribed from "InsureMyNation Privacy Policy.pdf".
//
// Each section is a list of blocks: { p }, { h } (sub-heading), { ul } or
// { table: { head, rows } }. Text is a string, or an array of parts where a
// part is a string, { b } (bold), { email: true } (the contact email as a
// mailto link) or { to, text } (an in-site link).

const mail = { email: true };

export const PRIVACY_EFFECTIVE = '22 October 2026';
export const PRIVACY_UPDATED = '22 October 2026';

export const PRIVACY_SECTIONS = [
  {
    title: 'About this policy',
    blocks: [
      {
        p: 'This policy explains what personal data InsureMyNation collects, why we collect it, who we share it with, and the choices you have. It applies when you visit our website, chat with our AI insurance advisor, message us on WhatsApp, or speak to our team.',
      },
      {
        p: 'It covers website visitors, people who ask for quotes or advice, our customers and their family members, and anyone who contacts us. Please read it before you share your details with us. Where we rely on your consent, we ask for it clearly and separately, and you can withdraw it at any time (see Section 7).',
      },
    ],
  },
  {
    title: 'Who we are',
    blocks: [
      {
        p: `InsureNation ("InsureMyNation", "we", "us") is an insurance broker registered with the Insurance Regulatory and Development Authority of India (IRDAI) as a Direct Broker, registration code IRDAI/DB 1093/2023. Our registered office is at ${ADDRESS}.`,
      },
      {
        p: `We decide why and how your personal data is processed, so we are the Data Fiduciary for it under Indian law. We operate the website www.insuremynation.com, our WhatsApp number ${PHONE}, and our AI insurance advisor, Asha, together called the "Platform".`,
      },
      {
        p: 'As a broker, we help you compare and buy insurance from insurers we work with. The insurer that issues your policy also processes your data under its own privacy policy.',
      },
    ],
  },
  {
    title: 'Laws we follow',
    blocks: [
      { p: 'This policy is written to meet:' },
      {
        ul: [
          'the Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025 (together, "DPDP law");',
          'the Information Technology Act, 2000 and the rules made under it, including the Reasonable Security Practices and Procedures and Sensitive Personal Data or Information Rules, 2011, to the extent they still apply;',
          "IRDAI regulations that apply to insurance brokers, including rules on record keeping, customer information, and protection of policyholders' interests.",
        ],
      },
      {
        p: 'Where these laws require us to keep or disclose information, we follow the law even if this policy says otherwise.',
      },
    ],
  },
  {
    title: 'Information we collect',
    blocks: [
      {
        p: 'We collect only what we need to advise you, arrange your insurance, and service it. Some of it is about family members or others you want to insure; please share their details only if they know you are doing so.',
      },
      {
        table: {
          head: ['Type of data', 'Examples', 'How we get it'],
          rows: [
            [
              'Contact and identity',
              'Name, mobile number, email, city, date of birth or age, gender',
              'You, through forms, the AI advisor, WhatsApp or calls',
            ],
            [
              'People to be insured',
              'Relation to you (spouse, child, parent), their ages, who needs cover',
              'You, mostly through the AI advisor',
            ],
            [
              'Health information',
              'Existing conditions, medical history, lifestyle details, medical reports',
              'You, when you ask about or apply for health or life cover',
            ],
            [
              'Policy and claim records',
              'Quotes, proposals, policies bought, renewals, claims you ask us to help with',
              'You, and the insurers we work with',
            ],
            [
              'Conversation records',
              'Chat messages, WhatsApp messages, hand-over summaries, call notes',
              'You, and our team',
            ],
            [
              'Technical data',
              'IP address, device and browser type, pages visited, cookie and device identifiers',
              'Automatically, when you use the Platform',
            ],
          ],
        },
      },
      {
        p: "We do not ask for, and our AI advisor is built to refuse, card numbers, passwords, and one-time passwords (OTPs). You pay premiums directly through the insurer's payment gateway, so we never receive or store your card or bank details.",
      },
    ],
  },
  {
    title: 'Our AI insurance advisor',
    blocks: [
      {
        p: 'Our chat advisor, Asha, is an AI system, not a person. It is available on our website, and it hands you to a member of our team whenever you ask or when it cannot help.',
      },
      { h: 'What it captures' },
      {
        ul: [
          'Your messages, in the language you write in.',
          'The people your message is about (for example "me, my wife and my father"), how they relate to you, and details you state about them, such as age or a health condition.',
          'Whether you stated a detail as a fact or only as a "what if", so that hypothetical questions are not saved as facts about you.',
          'What you are asking, the topic, and the tone of the conversation, so it can reply appropriately.',
          'Your name and phone number, if you ask for a call back or are handed to our team.',
        ],
      },
      { h: 'How it works with your data' },
      {
        ul: [
          [
            { b: 'Memory within a chat.' },
            " It keeps a record of each conversation: the people and details mentioned, questions asked, options discussed, and short notes. If you correct a detail, the new value is used and the old one is kept in the record's history.",
          ],
          [
            { b: 'Memory across chats.' },
            " By default, your details do not carry over to a new chat. If you sign in, we may switch this on for your account so you don't have to repeat your details; we will tell you before we do.",
          ],
          [
            { b: 'Recognising you.' },
            ' If you are not signed in, we set a device cookie so your chat history stays with your browser.',
          ],
          [
            { b: 'Checking options.' },
            " Plain software rules, not AI, check each plan's printed eligibility rules (such as entry age) against the people you describe and rank the options fairly. The advisor gives information and suggestions; the insurer makes the final decision on whether to offer you cover and at what premium.",
          ],
          [
            { b: 'Decision record.' },
            ' For each recommendation, the system keeps a private note of which options it considered and why. Our team can review it to check the advice was fair.',
          ],
          [
            { b: 'Hand-over.' },
            ' Before passing you to our team, it asks for your name and phone number (at most three times) and respects a "please do not contact me". Our team receives a short summary of the conversation.',
          ],
        ],
      },
      { h: 'AI service providers' },
      {
        p: 'To understand and answer your messages, the conversation is sent to AI models run by outside companies: Anthropic (Claude), which runs the advisor, and OpenAI, which converts text into search data so earlier parts of a chat and relevant documents can be found. These companies process the data only on our instructions and may do so on servers outside India (see Section 8). If we add or change an AI provider, we will update this list.',
      },
      { h: 'Using conversations to improve the advisor' },
      {
        p: "We store chat transcripts and may review them, including by members of our team or our technology partner Continuum Core Pvt. Ltd., to check accuracy, fix mistakes, and improve the advisor's answers. We do not allow our AI providers to train their own models on your conversations. Our system logs hide email addresses and phone numbers.",
      },
      {
        p: 'AI can make mistakes. Please check important details, such as coverage and exclusions, against the policy wording or with our team before you buy.',
      },
    ],
  },
  {
    title: 'How we use your information',
    blocks: [
      {
        p: 'We use your data only for the purposes below, and we tell you the purpose when we ask for it.',
      },
      {
        table: {
          head: ['Purpose', 'Basis'],
          rows: [
            ['Answer your questions and suggest suitable insurance options', 'Your consent'],
            [
              'Get quotes from insurers and submit your proposal',
              'Your consent, and to arrange the policy you asked for',
            ],
            [
              'Service your policy: renewals, changes, and help with claims',
              'Your consent, and to provide the service you bought',
            ],
            [
              'Call you back or hand your chat to our team',
              'Your consent, given when you share your number',
            ],
            [
              'Send service messages, such as renewal reminders and policy documents',
              'Your consent, and our duties to policyholders',
            ],
            [
              'Send offers and product updates on WhatsApp',
              'Your separate consent, which you can withdraw at any time',
            ],
            ['Review chats to check advice quality and improve the AI advisor', 'Your consent'],
            [
              'Measure and improve our website and ads',
              'Your consent to non-essential cookies (Section 9)',
            ],
            [
              'Prevent fraud and misuse, and keep the Platform secure',
              'Legitimate uses allowed by law',
            ],
            ['Keep records and respond to IRDAI, courts, or other authorities', 'Legal obligation'],
          ],
        },
      },
      {
        p: 'We do not sell your personal data. We do not use your health information for marketing.',
      },
    ],
  },
  {
    title: 'Your consent and how we contact you',
    blocks: [
      {
        p: 'When you start a chat, fill a form, or share your number, we show a short notice and ask for your consent for the purposes listed in Section 6. Consent for marketing is asked separately and is never a condition for getting advice or buying a policy.',
      },
      {
        p: [
          { b: 'How we contact you.' },
          ' We send service messages (quotes, policy documents, renewal reminders, claim updates) and, if you agree, offers and product updates on WhatsApp. Our team may also call you when you ask for a call back or are handed over from the AI advisor.',
        ],
      },
      {
        p: [
          { b: 'Do Not Disturb.' },
          " If your number is registered on the National Customer Preference Register (DND), we will send promotional messages only where you have given us explicit consent, as allowed by TRAI's rules. Service and transactional messages about a policy or request you made are not affected.",
        ],
      },
      {
        p: [
          { b: 'Withdrawing consent.' },
          ' You can withdraw any consent at any time, as easily as you gave it:',
        ],
      },
      {
        ul: [
          'reply "STOP" to any WhatsApp message from us to stop marketing messages;',
          'tell the AI advisor or our team that you do not want to be contacted;',
          ['email ', mail, '.'],
        ],
      },
      {
        p: 'We act on your request within 7 working days. Withdrawing consent does not affect processing already done. If you withdraw consent we need to service an active policy, we may not be able to keep helping with it, and we will tell you if so.',
      },
    ],
  },
  {
    title: 'Who we share your data with',
    blocks: [
      { p: 'We share your data only as needed for the purposes in Section 6.' },
      {
        table: {
          head: ['Who', 'What they receive', 'Why'],
          rows: [
            [
              'Insurers we work with',
              'Details needed for quotes, proposals, policy issuance, renewals and claims',
              'To arrange and service your insurance',
            ],
            [
              'Our technology partner, Continuum Core Pvt. Ltd.',
              'Data held on the Platform, including chat records',
              'To build, host, run and support the Platform and AI advisor on our behalf',
            ],
            [
              'AI providers: Anthropic and OpenAI',
              'Chat messages and related context',
              'To understand and answer your messages (Section 5)',
            ],
            [
              'Meta (WhatsApp)',
              'Your WhatsApp number and the messages you exchange with us',
              'To deliver messages between you and our team',
            ],
            [
              'Meta and Google (advertising and analytics)',
              'Cookie and device data, and the pages you visit',
              'To measure and improve our website and ads, only with your cookie consent',
            ],
            [
              'Regulators, courts and law enforcement',
              'What the law requires',
              'To comply with IRDAI rules, court orders and other legal duties',
            ],
            [
              'A buyer or merged business',
              'Your data, under this policy',
              'If our business is sold or merged',
            ],
          ],
        },
      },
      {
        p: 'Everyone who processes data for us does so under a written contract, only on our instructions, with security safeguards, and must delete or return the data when the work ends.',
      },
      {
        p: [
          { b: 'Data outside India.' },
          ' Some of these providers, including our AI providers, may process your data outside India. We transfer data only to countries the Government of India has not restricted, and we require the same level of protection there.',
        ],
      },
    ],
  },
  {
    title: 'Cookies and tracking',
    blocks: [
      { p: 'Cookies are small files stored in your browser. We use three kinds:' },
      {
        table: {
          head: ['Kind', 'Examples', 'Can you turn it off?'],
          rows: [
            [
              'Essential',
              'Sign-in cookie; device cookie that keeps your AI advisor chat history; security and spam protection',
              'No, the Platform needs them to work',
            ],
            ['Analytics', 'Google Analytics, to see which pages are used and how', 'Yes'],
            [
              'Advertising',
              'Meta Pixel and Google Ads, to measure our ads and show you relevant ads on other sites',
              'Yes',
            ],
          ],
        },
      },
      {
        p: "We load analytics and advertising cookies only after you agree in our cookie banner. To change your choice later, block or delete cookies in your browser settings. You can also limit personalised ads through Google's Ads Settings and Meta's ad preferences. We do not pass the content of your chats or your health information to advertising tools.",
      },
    ],
  },
  {
    title: 'How we protect your data',
    blocks: [
      { p: 'We use reasonable technical and organisational safeguards, including:' },
      {
        ul: [
          'encryption of data in transit, and of stored secrets such as access keys;',
          'access only for team members who need it, with individual permissions;',
          'an audit trail of changes and of access to sensitive records, which cannot be edited or deleted;',
          'hiding email addresses and phone numbers in system logs;',
          'an AI advisor built to refuse card numbers, passwords and OTPs;',
          'written security and confidentiality terms with every provider who handles your data.',
        ],
      },
      {
        p: 'No system is completely secure. If a breach affects your personal data, we will tell you without delay, explaining what happened, the likely impact, and what you can do. We will also report it to the Data Protection Board of India and other authorities as the law requires.',
      },
      {
        p: 'Please keep your login details private. We will never ask for your password or OTP by phone, email or WhatsApp.',
      },
    ],
  },
  {
    title: 'Your rights',
    blocks: [
      { p: 'Under DPDP law, you have the right to:' },
      {
        ul: [
          [
            { b: 'Know' },
            ' what personal data we hold about you, how we use it, and who we have shared it with.',
          ],
          [{ b: 'Correct and update' }, ' data that is wrong, incomplete or out of date.'],
          [{ b: 'Erase' }, ' data we no longer need, unless the law requires us to keep it.'],
          [{ b: 'Withdraw consent' }, ' at any time (Section 7).'],
          [{ b: 'Nominate' }, ' someone to exercise your rights if you die or become unable to do so.'],
          [
            { b: 'Complain' },
            ' to us, and then to the Data Protection Board of India if you are not satisfied (Section 13).',
          ],
        ],
      },
      {
        p: [
          'To use any of these rights, email ',
          mail,
          ' or write to the Grievance Officer in Section 13. We may ask you to confirm your identity first. We will respond within 30 days.',
        ],
      },
    ],
  },
  {
    title: "Children's data",
    blocks: [
      {
        p: 'The Platform is meant for adults. We do not knowingly let anyone under 18 use the AI advisor or buy a policy on their own.',
      },
      {
        p: "Parents and legal guardians often share a child's details (such as age or health) to insure them under a family plan. When you do, you confirm that you are the child's parent or lawful guardian and consent on the child's behalf. We use a child's data only to arrange and service their cover, never for advertising, profiling or behavioural tracking.",
      },
      {
        p: "If you believe a child has shared data with us without a parent's consent, contact us and we will delete it.",
      },
    ],
  },
  {
    title: 'Questions and complaints',
    blocks: [
      {
        p: 'For any question, request or complaint about your personal data, contact our Grievance Officer, who also answers questions about how we process data:',
      },
      {
        ul: [
          [{ b: 'Nehal Kumar' }, ', Co-founder and Chief Executive Officer, InsureNation'],
          ADDRESS,
          ['Email: ', mail],
          `Phone: ${PHONE} (Monday to Saturday, 10 am to 6 pm)`,
        ],
      },
      {
        p: 'We acknowledge complaints within 48 hours and resolve them within 30 days. If you are not satisfied with our response, you can complain to the Data Protection Board of India.',
      },
      {
        p: [
          'For complaints about an insurance policy or claim (not about your data), you can also use our ',
          { to: '/claim-support', text: 'claim support page' },
          ", the insurer's grievance team, IRDAI's Bima Bharosa portal, or the Insurance Ombudsman.",
        ],
      },
    ],
  },
  {
    title: 'Changes to this policy',
    blocks: [
      {
        p: 'We may update this policy when our services, the AI advisor, or the law changes. We will post the new version here with a new date. If a change affects how we use data you have already given us, we will tell you on the Platform or by WhatsApp or email, and ask for fresh consent where the law requires it.',
      },
    ],
  },
];
