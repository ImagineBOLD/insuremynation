import { useCallback, useEffect, useRef, useState } from 'react';
import { BLUE, DEEP } from '../../data/site';
import { useHeadlessChat } from './useHeadlessChat';
import ChatPanel from './ChatPanel';
import RobotGlyph from './RobotGlyph';
import './chat.css';

/**
 * The assistant launcher and panel.
 *
 * Replaces the hosted imagine.bo widget script, which could not render this design — no
 * suggested replies, no date divider, no per-message avatar — and flattened every failure
 * to "Something went wrong", so a visitor could not tell a misconfiguration from a dropped
 * connection.
 *
 * Which page the visitor is on still decides where the funnel opens, but that is not this
 * component's business any more: useHeadlessChat reads the page context itself when it
 * starts a conversation. See pageContext.js.
 */
/**
 * The relationship manager's line, and the red it is painted in.
 *
 * Kept here rather than in `src/data/site.js` on purpose: that file is upstream's, and a pull
 * would take this with it. `site.js` holds the switchboard number (`PHONE`) — this is a
 * different, direct line, so the two are not meant to match.
 */
const RM_PHONE = '9876543210';
const RM_HREF = `tel:+91${RM_PHONE}`;
const RM_RED = '#C72A2D';

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const chat = useHeadlessChat();
  const launcherRef = useRef(null);

  const openPanel = useCallback(() => {
    setOpen(true);
    chat.init();
  }, [chat]);

  const closePanel = useCallback(() => {
    setOpen(false);
    // Return focus to the launcher so keyboard users are not dropped at the top of
    // the document.
    launcherRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closePanel]);

  /**
   * Locks the page behind the sheet while it is open, on phones only.
   *
   * The sheet covers most of the screen but not all of it, and a drag that starts outside the
   * transcript — on the header, the composer, the dimmed strip — otherwise scrolls the site
   * underneath. The chat appears to be stuck while the page slides away behind it.
   *
   * Desktop keeps its scroll: there the panel is a small card and the page around it is still
   * the thing being read.
   */
  useEffect(() => {
    if (!open || !window.matchMedia('(max-width: 560px)').matches) return undefined;
    document.body.classList.add('imn-chat-locked');
    return () => document.body.classList.remove('imn-chat-locked');
  }, [open]);

  return (
    <>
      {open && (
        <>
          {/* Visible only on a phone, where the panel is a sheet over the page: it dims what
              is behind and gives the visitor somewhere to tap to dismiss. `display` is left
              to chat.css so the media query decides — setting it inline would beat the
              stylesheet and put a dimmer over the desktop page too. */}
          <div
            className="imn-chat-backdrop"
            onClick={closePanel}
            aria-hidden="true"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2147482999,
              background: 'rgba(0,13,40,0.45)',
            }}
          />
          <ChatPanel chat={chat} onClose={closePanel} />
        </>
      )}

      {/* `--open` is what hides this on a phone. The panel goes full-screen below 560px, and
          the launcher is fixed to the same corner at the same z-index but painted after it,
          so it sits on top of the send button. On desktop it stays put and becomes the
          close control. */}
      <button
        ref={launcherRef}
        type="button"
        className={open ? 'imn-chat-launcher imn-chat-launcher--open' : 'imn-chat-launcher'}
        onClick={() => (open ? closePanel() : openPanel())}
        aria-label={open ? 'Close chat' : 'Chat with the InsureMyNation Assistant'}
        aria-expanded={open}
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 2147483000,
          width: 60,
          height: 60,
          borderRadius: '50%',
          border: 0,
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(180deg, ${BLUE} 0%, ${DEEP} 140%)`,
          boxShadow: '0 10px 28px rgba(0,30,71,0.28)',
        }}
      >
        {open ? <CloseGlyph /> : <ChatGlyph />}
      </button>

      {/* Call the RM. An anchor, not a button: `tel:` is the platform's job — it dials on a
          phone, hands off to the desktop's calling app, and offers copy/paste on the rest,
          none of which JavaScript does better. Sits one launcher-width to the left, and hides
          with the launcher on a phone, where the panel is a full-screen sheet. */}
      <a
        className={open ? 'imn-chat-call imn-chat-call--open' : 'imn-chat-call'}
        href={RM_HREF}
        aria-label={`Call your relationship manager on ${RM_PHONE}`}
        title={`Call your relationship manager — ${RM_PHONE}`}
        style={{
          position: 'fixed',
          // 24 (launcher's own gap) + 60 (its width) + 12 (space between the two).
          right: 96,
          bottom: 24,
          zIndex: 2147483000,
          width: 60,
          height: 60,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: RM_RED,
          boxShadow: '0 10px 28px rgba(0,30,71,0.28)',
        }}
      >
        <PhoneGlyph />
      </a>
    </>
  );
}

function ChatGlyph() {
  return <RobotGlyph size={32} fill="#fff" />;
}

function PhoneGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
