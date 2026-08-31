import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BLUE, DEEP, EMAIL, PHONE } from '../../data/site';
import ContactForm from './ContactForm';
import Message from './Message';
import RobotGlyph from './RobotGlyph';

export default function ChatPanel({ chat, onClose }) {
  const { messages, pending, error, send, clearError, reset, chips, finished, askContact,
    dismissContact } = chat;
  const [draft, setDraft] = useState('');
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  /**
   * Sizes and positions the bottom sheet on a phone, against the *visual* viewport.
   *
   * Below 560px the panel is a sheet anchored to the bottom (see chat.css), deliberately
   * short of full height so the page stays visible above it and the chat reads as an overlay
   * on the site rather than a separate app.
   *
   * Two things CSS cannot do here. `bottom: 0` is the *layout* viewport, which an on-screen
   * keyboard does not shrink — so the sheet, and the composer with it, would sit underneath
   * the keyboard exactly when it is being typed into; `dvh` does not help, it tracks browser
   * chrome, not keyboards. And the sheet has to give up its margin when the keyboard takes
   * the space it was leaving to the page.
   *
   * A real keyboard cannot be emulated headlessly, so `scratchpad/mobile.mjs` exercises the
   * resize path by shrinking the whole viewport, which is a smaller phone rather than a
   * keyboard. The keyboard branch itself is reasoned, not measured.
   *
   * Nothing is set on desktop, where the panel is a fixed card and the inline styles fit.
   */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;

    const SHEET = 0.85; // of the viewport, with the keyboard down

    const apply = () => {
      const el = panelRef.current;
      if (!el) return;
      const h = vv.height;
      // A keyboard shrinks the visual viewport and leaves the layout viewport alone, so the
      // gap between the two is the signal — no need to remember a previous height, which
      // would be wrong for anyone who opens the chat with the keyboard already up. Once the
      // keyboard is there is no room to spare, so the sheet takes what is left rather than
      // keep showing page behind it.
      const keyboardUp = h < window.innerHeight * 0.8;
      // Custom properties, not `style.height` / `style.bottom`. Those two are set inline by
      // the component to the design's desktop card, and writing them here — or removing them
      // again above 560px — destroys that card, which is how the desktop panel ended up with
      // no anchor and off-screen. chat.css consumes these only inside the phone breakpoint,
      // so on desktop they sit unused.
      el.style.setProperty('--imn-sheet-h', `${Math.round(keyboardUp ? h : h * SHEET)}px`);
      // How far the visual viewport's bottom sits above the layout viewport's — zero until a
      // keyboard or a browser toolbar takes space.
      el.style.setProperty(
        '--imn-sheet-bottom',
        `${Math.max(0, Math.round(window.innerHeight - h - vv.offsetTop))}px`
      );
    };

    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    window.addEventListener('orientationchange', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      window.removeEventListener('orientationchange', apply);
    };
  }, []);

  // Focus the composer on open, but not on a touch screen: focusing there summons the
  // keyboard over half the panel before the visitor has read the question, and the chips
  // are the answer most of them want anyway.
  useEffect(() => {
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      inputRef.current?.focus();
    }
  }, []);

  /**
   * Whether to offer the contact form.
   *
   * This used to key on `isContactAsk(last.text)` — matching the retired orchestrator's own
   * consent sentence. The corpus RAG answers questions rather than running a funnel and never
   * writes that sentence, so the form was unreachable and the website produced no leads at all.
   * The decision now comes from `useHeadlessChat` (an escalation, or three questions in), which
   * is our state rather than something parsed out of the assistant's prose.
   *
   * Declared above the scroll effect because that effect lists it as a dependency, and a
   * dependency array is evaluated during render.
   */
  const last = messages[messages.length - 1];
  const askingContact = !finished && !chips && askContact;

  // Pin to the newest content. Layout effect so the jump happens before paint
  // rather than as a visible scroll on every streamed token.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending, error, askingContact]);

  // `replyId` is vestigial — it belonged to the orchestrator's server-declared options and `send`
  // ignores it. `contact` is live: `{name, phone, email}` from ContactForm, which the RAG needs
  // before it can create a CRM lead.
  const submit = (text, replyId = null, contact) => {
    const value = (text ?? draft).trim();
    if (!value || pending) return;
    setDraft('');
    send(value, replyId, contact);
  };

  return (
    <div
      ref={panelRef}
      className="imn-chat-panel"
      role="dialog"
      aria-modal="false"
      aria-label="InsureMyNation Assistant"
      style={{
        position: 'fixed',
        right: 24,
        bottom: 96,
        zIndex: 2147483000,
        width: 380,
        maxWidth: 'calc(100vw - 48px)',
        height: 560,
        maxHeight: 'calc(100vh - 132px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 24px 60px rgba(0,30,71,0.24)',
        fontFamily: 'Poppins,sans-serif',
      }}
    >
      <Header
        onClose={onClose}
        // Only offered once there is something to clear, so it does not sit there
        // inviting a visitor to reset an empty conversation — and always once the
        // conversation is finished, since it is then the only way to start another.
        onReset={messages.length > 0 || finished ? reset : null}
      />

      <div
        ref={scrollRef}
        className="imn-chat-scroll"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '16px 16px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: '#fff',
        }}
      >
        <DayDivider />

        {/* No locally rendered greeting *here*: the opening message is a real message in the
            transcript, seeded by `init`. It is written client-side now rather than fetched —
            there is nothing to ask the service on open — but it is still a message, so it
            persists, scrolls and reads like one. */}
        {messages.map((m) => (
          <Message
            key={m.id}
            role={m.role}
            text={m.text}
            streaming={m.streaming}
            citations={m.citations}
          />
        ))}

        {error && <ErrorNotice error={error} onRetry={() => { clearError(); submit(error.retry); }} />}

        {/* Also inside the scroll area, and tall for the same reason: the home page opener
            offers all six covers, which is a seven-row list around 200px. Pinned below the
            transcript that came off a fixed-height panel and left the very message the
            options answer squeezed into a sliver. Here it scrolls with the conversation and
            the auto-scroll above keeps it in view, so the transcript keeps its height.
            Hidden while an error is showing, so the retry link is the only thing to click.
            Never the *only* way to answer: the composer stays available so a visitor can
            type "we are four in Gurgaon" instead of picking from the list.
            Two presentations, picked by how much space the options need: a short set stays
            wrapped pills; a long set becomes one bordered group of radio-style rows. The
            circle is decoration — a tap still submits the label as a message, so no second
            confirm. */}
        {chips && !error && <ChipRow chips={chips} pending={pending} onPick={submit} />}

        {/* Inside the scroll area because it is tall. Pinned below the transcript it would
            be clipped by the panel's overflow on a short screen — and with nothing
            scrollable under the visitor's finger the gesture falls through to the page
            behind, which reads as a form that cannot be scrolled. Here it scrolls with the
            conversation, and the auto-scroll below brings it into view. */}
        {askingContact && !error && (
          <ContactForm
            disabled={pending}
            onDismiss={dismissContact}
            onSubmit={(text, contact) => submit(text, null, contact)}
          />
        )}
      </div>

      {finished ? (
        <FinishedNotice onReset={reset} />
      ) : (
        <Composer
          draft={draft}
          setDraft={setDraft}
          pending={pending}
          inputRef={inputRef}
          onSubmit={() => submit()}
        />
      )}
    </div>
  );
}

/**
 * The options under a question. Pills while the set is small; a radio-style list once it
 * is not. The threshold is space, not count: three short answers ("Yes / No / Not sure")
 * sit in one pill row, but three long ones already wrap to three, at which point rows
 * with a separator read better and pack tighter. A server option carrying a description
 * needs two lines, so it always gets a row.
 *
 * Every chip is `{ id, label, description }`. The id is echoed as `reply_id`, which on a
 * consent option is the tap that gets recorded — see HEADLESS_CHAT_INTEGRATION.md.
 *
 * Two shortcuts are appended to heuristic (`- ` line) sets, so the visitor can shift
 * mid-funnel without typing: "Change policy type" (skipped when the set already *is* the
 * cover list — the opener's six products) and "Request callback" (skipped when the turn
 * already offers a callback of its own). Server-declared options never get them: those
 * are the turn's real choices — on the WhatsApp consent turn the two buttons ARE the
 * answer set, and a shortcut beside them invites skipping a permission question.
 *
 * A shortcut's `value` is what gets sent, and it is deliberately not the label: run 6390
 * showed the bot reads the bare label "Change policy type" as "change my *existing*
 * policy" and routes to porting — the sentence below is the wording that reliably routes
 * to the cover list instead. The orchestrator routes typed text, so nothing here models
 * the funnel.
 */
const PRODUCT = /health|life|car|bike|travel|marine/i;

function ChipRow({ chips, pending, onPick }) {
  const shortcut = (label, value) => ({ id: null, label, value, description: null, shortcut: true });
  const serverDeclared = chips.some((c) => c.id != null);
  const all = [...chips];
  if (!serverDeclared) {
    if (chips.filter((c) => PRODUCT.test(c.label)).length < 3)
      all.push(
        shortcut('Change policy type', 'I want a different type of insurance. Which covers do you offer?')
      );
    if (!chips.some((c) => /call\s?back/i.test(c.label)))
      all.push(shortcut('Request callback'));
  }

  const asList = all.length > 3 || all.some((c) => c.label.length > 28 || c.description);

  if (!asList) {
    return (
      <div
        className="imn-chat-chips"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, flexShrink: 0 }}
      >
        {all.map((chip) => (
          <button
            key={chip.label}
            type="button"
            className="imn-chat-chip"
            disabled={pending}
            // The label *is* the message — no aria-label, because it would only repeat
            // the visible text.
            onClick={() => onPick(chip.value ?? chip.label, chip.id)}
            style={{
              appearance: 'none',
              background: chip.shortcut ? 'rgba(0,74,173,0.06)' : '#fff',
              border: '1.5px solid rgba(0,74,173,0.22)',
              borderRadius: 10,
              padding: '7px 12px',
              fontFamily: 'inherit',
              fontWeight: chip.shortcut ? 500 : 400,
              fontSize: 11,
              lineHeight: 1.2,
              color: BLUE,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className="imn-chat-chips"
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '1.5px solid rgba(0,74,173,0.22)',
        borderRadius: 12,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {all.map((chip, i) => (
        <button
          key={chip.label}
          type="button"
          className="imn-chat-chip"
          disabled={pending}
          onClick={() => onPick(chip.value ?? chip.label, chip.id)}
          style={{
            appearance: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            background: chip.shortcut ? 'rgba(0,74,173,0.06)' : '#fff',
            border: 0,
            borderTop: i > 0 ? '1px solid rgba(0,74,173,0.12)' : 0,
            padding: '7px 12px',
            fontFamily: 'inherit',
            fontWeight: chip.shortcut ? 500 : 400,
            fontSize: 11,
            lineHeight: 1.2,
            color: BLUE,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              border: '1.5px solid rgba(0,74,173,0.45)',
              flexShrink: 0,
            }}
          />
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            {chip.label}
            {chip.description && (
              <span style={{ fontSize: 10, fontWeight: 300, color: 'rgba(0,30,71,0.55)' }}>
                {chip.description}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

function Header({ onClose, onReset }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '14px 12px 14px 16px',
        background: `linear-gradient(180deg, ${BLUE} 0%, ${DEEP} 160%)`,
        flexShrink: 0,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          background: BLUE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <RobotGlyph size={20} fill="#fff" />
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 500, fontSize: 15, color: '#fff', lineHeight: 1.2 }}>
          InsureMyNation Assistant
        </div>
      </div>

      {onReset && (
        <button
          type="button"
          className="imn-chat-iconbtn"
          onClick={onReset}
          aria-label="Start a new chat, clearing this conversation"
          title="New chat"
          style={{
            appearance: 'none',
            border: 0,
            background: 'none',
            borderRadius: 8,
            width: 34,
            height: 34,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M3 12a9 9 0 0 1 15.5-6.2M21 12a9 9 0 0 1-15.5 6.2M18 3v4h-4M6 21v-4h4"
              stroke="#fff"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      <button
        type="button"
        className="imn-chat-iconbtn"
        onClick={onClose}
        aria-label="Close chat"
        style={{
          appearance: 'none',
          border: 0,
          background: 'none',
          borderRadius: 8,
          width: 34,
          height: 34,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function DayDivider() {
  return (
    <div
      style={{
        alignSelf: 'center',
        fontSize: 12,
        fontWeight: 400,
        color: 'rgba(0,74,173,0.55)',
        padding: '2px 0 4px',
      }}
    >
      Today
    </div>
  );
}

/**
 * A failed turn, shown in place with the backend's own wording.
 *
 * The message matters: the backend distinguishes "too many messages", "chatbot not
 * configured" and an upstream outage, and each tells the visitor something different
 * about whether waiting will help.
 */
function ErrorNotice({ error, onRetry }) {
  const rateLimited = /too many/i.test(error.message);
  // Some messages already carry the number — the orchestrator client's 403/404 text does —
  // and printing it twice in one notice reads as a bug.
  const hasNumber = error.message.includes(PHONE);
  return (
    <div
      role="alert"
      style={{
        alignSelf: 'stretch',
        background: 'rgba(199,42,45,0.06)',
        border: '1px solid rgba(199,42,45,0.22)',
        borderRadius: 12,
        padding: '10px 12px',
        fontSize: 13,
        lineHeight: 1.5,
        color: 'rgb(150,30,33)',
      }}
    >
      <div>{error.message}</div>
      {!rateLimited && !hasNumber && (
        <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(0,30,71,0.7)' }}>
          You can also call {PHONE} or email {EMAIL}.
        </div>
      )}
      {error.retry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            appearance: 'none',
            marginTop: 8,
            border: 0,
            background: 'none',
            padding: 0,
            font: 'inherit',
            fontSize: 13,
            fontWeight: 500,
            color: BLUE,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * Replaces the composer once the conversation reaches a terminal state.
 *
 * The composer is removed rather than merely disabled because the session is deleted
 * server-side: sending into it would silently open a *second* conversation, and since that
 * conversation ends in a lead, the sales desk would get the same person twice.
 */
function FinishedNotice({ onReset }) {
  return (
    <div
      className="imn-chat-finished"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '12px 14px',
        borderTop: '1px solid rgba(0,74,173,0.12)',
        flexShrink: 0,
        background: '#fff',
        fontSize: 13,
        fontWeight: 300,
        color: 'rgba(0,30,71,0.7)',
      }}
    >
      <span>This chat is complete.</span>
      <button
        type="button"
        onClick={onReset}
        style={{
          appearance: 'none',
          border: 0,
          background: 'none',
          padding: 0,
          font: 'inherit',
          fontWeight: 500,
          color: BLUE,
          cursor: 'pointer',
          textDecoration: 'underline',
        }}
      >
        Start a new chat
      </button>
    </div>
  );
}

function Composer({ draft, setDraft, pending, inputRef, onSubmit }) {
  return (
    <form
      className="imn-chat-composer"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        padding: '10px 12px 12px',
        borderTop: '1px solid rgba(0,74,173,0.12)',
        flexShrink: 0,
        background: '#fff',
      }}
    >
      <textarea
        ref={inputRef}
        className="imn-chat-input"
        rows={1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          // Enter sends; Shift+Enter is a newline, which is what a multi-line
          // question about a policy needs.
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder="Ask anything..."
        aria-label="Message"
        maxLength={2000}
        style={{
          flex: 1,
          minWidth: 0,
          resize: 'none',
          maxHeight: 96,
          border: 0,
          background: 'transparent',
          padding: '8px 4px',
          fontFamily: 'inherit',
          fontWeight: 300,
          fontSize: 14,
          lineHeight: 1.5,
          color: BLUE,
        }}
      />
      <button
        type="submit"
        className="imn-chat-send"
        disabled={pending || !draft.trim()}
        aria-label="Send message"
        style={{
          appearance: 'none',
          border: 0,
          width: 38,
          height: 38,
          borderRadius: '50%',
          background: BLUE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            // Apex on the right, wing tips on the left. The previous path had it the other
            // way round, which drew the plane pointing back at the transcript.
            d="M20 12 4 4l6 8-6 8 16-8Z"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </form>
  );
}
