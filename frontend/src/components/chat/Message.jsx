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
export default function Message({ role, text, streaming, citations }) {
  const isUser = role === 'user';
  // Only the assistant writes markdown at us. The visitor's own words are shown back exactly
  // as they typed them.
  const shown = isUser ? text : unwrapEmphasis(text);

  return (
    <div
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

        {!isUser && <Citations items={citations} />}
      </div>
    </div>
  );
}

/**
 * The documents the answer came from.
 *
 * There was no citation line here before, and the comment that stood in its place explained
 * why: the knowledge base was one generated file, so the only thing a citation could have
 * named was "insuremynation-website.txt" — an internal build artefact that means nothing to a
 * visitor and reads as a leak. That is no longer what a citation is. Each one now names a real
 * insurer document and links to the insurer's own PDF, which is the strongest thing this
 * assistant can say for itself.
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
        // No source_url on a document we hold but the insurer does not publish — show the
        // name unlinked rather than an anchor that goes nowhere.
        return c.source_url ? (
          <a
            key={c.doc_id ?? i}
            href={c.source_url}
            target="_blank"
            rel="noopener noreferrer"
            style={citation}
          >
            {label}
          </a>
        ) : (
          <span key={c.doc_id ?? i} style={{ ...citation, color: 'rgba(0,30,71,0.55)' }}>
            {label}
          </span>
        );
      })}
    </div>
  );
}

const citation = {
  fontSize: 11,
  fontWeight: 300,
  lineHeight: 1.6,
  color: BLUE,
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
