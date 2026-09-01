import { BLUE, DEEP } from '../../data/site';
import { citationLabel } from './askResponse';
import { unwrapEmphasis } from './unwrapEmphasis';

/**
 * One bubble. Assistant on the left with the brand mark, visitor on the right with a
 * neutral avatar.
 *
 * `text` is rendered as text, never as markup: it is model output built from
 * retrieved document content, so treating it as HTML would be an injection path
 * straight through the knowledge base. `pre-wrap` keeps the model's own line
 * breaks, which are deliberate.
 *
 * The one concession to markdown is `unwrapEmphasis`: the model writes `**Cover**`
 * whatever the prompt says, and with no renderer the asterisks land on the screen.
 * It removes paired delimiters and nothing else — no library, no HTML.
 *
 * `citations` are the documents the answer was built from, rendered under the bubble.
 */
export default function Message({ role, text, streaming, citations, plans }) {
  const isUser = role === 'user';
  // Only the assistant writes markdown at us. The visitor's own words are shown back exactly
  // as they typed them.
  const shown = isUser ? text : unwrapEmphasis(text);

  return (
    <div
      // The scroll effect looks for the newest assistant turn by this attribute, so it can put
      // the top of a long reply at the top of the panel instead of its last line.
      data-msg={role}
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        gap: 8,
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '88%',
      }}
    >
      {isUser ? <UserAvatar /> : <BotAvatar />}

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            background: isUser ? DEEP : '#f1f5f9',
            color: isUser ? '#fff' : 'rgb(15,23,42)',
            borderRadius: 14,
            // Squared-off corner on the speaker's side, so the bubble points at its
            // avatar the way the design does.
            borderBottomRightRadius: isUser ? 4 : 14,
            borderBottomLeftRadius: isUser ? 14 : 4,
            padding: '10px 13px',
            fontWeight: 300,
            fontSize: 14,
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere',
          }}
        >
          {shown}
          {streaming && !text && <TypingDots />}
        </div>

        {!isUser && <PlanCards items={plans} />}
        {!isUser && <Citations items={citations} />}
      </div>
    </div>
  );
}

/**
 * The shortlist, one card per plan.
 *
 * These used to be three names inside the sentence, separated by semicolons with the insurer in
 * brackets after each: "Stand-Alone Motor Own Damage Policy - Two Wheeler (Royal Sundaram);
 * IndusInd Two Wheeler Policy - Bundled (IndusInd); ...". Reported, fairly, as not being able to
 * tell which was which. They arrive as data now and get a card each.
 *
 * Not clickable, for the same reason the citations stopped being links: we are a broker, and
 * every link out of this panel is an exit to a company the visitor can buy from directly.
 * Choosing between them is what the counsellor call is for.
 *
 * The card shape is ContactForm's, which is already the panel's language for "a thing inside the
 * conversation rather than a bubble in it".
 */
function PlanCards({ items }) {
  if (!items?.length) return null;
  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((p, i) => {
        const name = p?.plan_name;
        if (!name) return null;
        // plan_type is empty on a handful of records; the separator would dangle without it.
        const sub = [p.insurer, p.plan_type].filter(Boolean).join(' · ');
        return (
          <div key={`${name}-${i}`} style={planCard}>
            <div style={planName}>{name}</div>
            {sub && <div style={planMeta}>{sub}</div>}
          </div>
        );
      })}
    </div>
  );
}

const planCard = {
  padding: '9px 12px',
  border: '1px solid rgba(0,74,173,0.14)',
  borderRadius: 14,
  background: '#f8fafc',
};

const planName = {
  fontSize: 13,
  fontWeight: 500,
  color: DEEP,
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
};

const planMeta = {
  fontSize: 11,
  fontWeight: 300,
  lineHeight: 1.5,
  color: 'rgba(0,30,71,0.6)',
  overflowWrap: 'anywhere',
};

/**
 * The documents the answer came from.
 *
 * There was no citation line here before, and the comment that stood in its place explained
 * why: the knowledge base was one generated file, so the only thing a citation could have
 * named was "insuremynation-website.txt" — an internal build artefact that means nothing to a
 * visitor and reads as a leak. That is no longer what a citation is. Each one now names a real
 * insurer document, which is the strongest thing this assistant can say for itself.
 *
 * **Named, never linked.** These used to be anchors to the insurer's own PDF. We are a broker:
 * every one of those was an exit to a company the visitor could then buy from directly, placed
 * under our own answer, on our own site. The document name carries the whole benefit — the
 * answer is traceable to something real — and the link carried only the risk. `source_url` still
 * arrives in the response and is deliberately not rendered.
 *
 * Inside the bubble's wrapper rather than beside it, so it inherits the row's 88% max width
 * and the left/right flip. A sibling of <Message> would pick up the scroll container's 12px
 * gap and sit in the middle of the panel.
 *
 * `section_path`, `page` and `confidence` are deliberately dropped — this is an attribution
 * line, not a footnote. So is `line`, which is unreliable in the corpus: a health policy came
 * back tagged `fire-commercial`. `restricted` gets no badge either; it only means we do not
 * quote premiums from that document, and saying so invites the question the guardrail exists
 * to avoid.
 */
function Citations({ items }) {
  if (!items?.length) return null;
  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {items.slice(0, 4).map((c, i) => {
        const label = citationLabel(c);
        if (!label) return null;
        return (
          <span key={c.doc_id ?? i} style={citation}>
            {label}
          </span>
        );
      })}
    </div>
  );
}

// Muted, not BLUE. It was the link colour while these were anchors; left blue on plain text it
// reads as a link that does not respond, which is worse than either.
const citation = {
  fontSize: 11,
  fontWeight: 300,
  lineHeight: 1.6,
  color: 'rgba(0,30,71,0.55)',
  overflowWrap: 'anywhere',
};

function TypingDots() {
  return (
    <span
      style={{ display: 'inline-flex', gap: 4, alignItems: 'center', height: 14 }}
      aria-label="Assistant is typing"
      role="status"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="imn-chat-dot"
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'rgba(0,74,173,0.55)',
            display: 'block',
          }}
        />
      ))}
    </span>
  );
}

function BotAvatar() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 26,
        height: 26,
        borderRadius: 7,
        flexShrink: 0,
        background: 'rgba(0,74,173,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"
          stroke={BLUE}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function UserAvatar() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 26,
        height: 26,
        borderRadius: '50%',
        flexShrink: 0,
        background: 'rgba(0,74,173,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
          stroke={BLUE}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
