import { useCallback, useEffect, useRef, useState } from 'react';
import { PHONE } from '../../data/site';
import { readAnswer } from './askResponse';
import { pageContext, readJSON, writeJSON } from './pageContext';
import { splitOptions } from './splitOptions';

/**
 * Chat state and transport for the InsureNation corpus RAG.
 *
 * One endpoint, same-origin: `POST /v1/ask`, proxied by our own Go service, which holds
 * `RAG_API_KEY` and adds the bearer header. The browser never sees a credential, which is
 * the whole reason the proxy exists — this site is a Vite build, so a key in a `VITE_*`
 * variable is compiled into the public bundle and is not a key at all.
 *
 * The file keeps its old name. It used to call imagine.bo's orchestrator direct from the
 * browser with a widget token, and everything that made that integration what it was is gone
 * with it: **there is no server-issued session, no `reply_id`, no funnel and no terminal
 * state.** The service stores nothing between turns, so `history` is sent from here on every
 * request and a restart their side cannot lose a conversation.
 *
 * What that removes is lead capture. Their assistant asked for the visitor's contact details
 * itself; ours answers questions and does not run a funnel, so until the contact ask is
 * rebuilt on this side (`ContactForm.jsx` and `contactAsk.js` are parked in the tree for it)
 * the website channel produces no leads at all. A known, accepted gap — not something to work
 * around here.
 *
 * `session_id` is sent for that rebuild. It is **not** a token and grants nothing: the RAG
 * uses it to group a conversation so it can report the lead once a phone number exists. It is
 * minted here, persisted with the transcript so a refresh does not split one conversation
 * into two CRM leads, and replaced on `reset`.
 */

const ENDPOINT = '/v1/ask';
// The panel's first turn. Same-origin like /v1/ask, and the key stays in the Go service.
const OPENER_ENDPOINT = '/v1/opener';

/** A turn runs retrieval, an embedding call and a completion, and may retry the completion. */
const REQUEST_TIMEOUT = 45_000;
const MAX_MESSAGE_LEN = 2000;

/** Turns of context sent back. Enough for "and what about my wife?", short enough to bill. */
const HISTORY_TURNS = 8;

/**
 * Questions before the contact form is offered unprompted. Three is enough to show the assistant
 * is useful and few enough that a visitor with real intent has not left. An escalation offers it
 * sooner, whatever the count.
 */
const CONTACT_AFTER_TURNS = 3;

const STATE_KEY = 'insurenation-chat-state';

/**
 * Local, not fetched. The old opener was a model turn, so every visitor who opened the panel
 * and closed it again cost a completion. There is nothing to ask the service on open, and the
 * panel must not open empty.
 */
const GREETING =
  "Hi! I'm the InsureNation assistant. I can help with new cover, a renewal, or a claim that " +
  "is stuck. I'm an automated assistant — anything we discuss is indicative and subject to " +
  'underwriting; a licensed counsellor gives the real numbers.\n\n' +
  'Which cover are you looking for?\n' +
  '- Health\n- Life\n- Car\n- Bike\n- Travel\n- Marine (cargo or hull)';

const newSessionId = () =>
  globalThis.crypto?.randomUUID?.() ?? `s${Date.now()}-${Math.round(Math.random() * 1e9)}`;

/**
 * One POST. Content-Type is the only header: an Authorization header here would be a mistake,
 * not a feature — the key lives in the Go service and the browser has nothing to send.
 */
async function post(body, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener('abort', onOuterAbort);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onOuterAbort);
  }
}

let nextId = 0;
const makeId = () => `m${nextId++}`;

/**
 * An assistant reply: the bubble text, its citations, and any chips it offered.
 *
 * `splitOptions` is a working feature again. It was dead for as long as the assistant only
 * answered questions — a document answer is prose and never carries a flush column-0 `- ` list,
 * so this found nothing. The qualification funnel emits its option lists in exactly that shape
 * on purpose, and the greeting opens with the six cover lines the same way, so most turns before
 * the shortlist now render as tappable chips instead of a list printed into a bubble.
 */
function assistantMessage(text, citations) {
  const { body, options } = splitOptions(text);
  return {
    id: makeId(),
    role: 'assistant',
    text: body,
    options: options.map((label) => ({ id: null, label, description: null })),
    citations: citations ?? [],
  };
}

/** Transcripts persisted before options carried ids are arrays of bare labels. */
const normalizeOption = (o) =>
  typeof o === 'string' ? { id: null, label: o, description: null } : o;

export function useHeadlessChat() {
  const restored = useRef(readJSON(STATE_KEY));
  const [messages, setMessages] = useState(() => restored.current?.messages ?? []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const sessionRef = useRef(restored.current?.sessionId ?? newSessionId());
  const busyRef = useRef(false);
  const abortRef = useRef(null);

  /**
   * The contact ask. `escalated` is the last reply's `escalate` — the assistant saying it cannot
   * help and offering a callback, which is the one moment the form is obviously wanted rather
   * than interruptive. `contactDone` closes it for good once the visitor has submitted or
   * dismissed it, and is persisted: re-asking someone who already said no, every refresh, is how
   * a chat widget gets closed permanently.
   */
  const [escalated, setEscalated] = useState(false);
  const [reason, setReason] = useState(null);
  const [contactDone, setContactDone] = useState(() => Boolean(restored.current?.contactDone));

  // Abort anything in flight when the component goes away, so a closed tab does not leave a
  // turn running that nobody will read.
  useEffect(() => () => abortRef.current?.abort(), []);

  /**
   * The transcript survives a refresh; without this the panel would come back empty in the
   * middle of a conversation, since there is no history endpoint to re-read it from.
   * sessionStorage, not local — people ask this assistant about health conditions.
   */
  const persist = useCallback(
    (msgs, done = contactDone) => {
      writeJSON(STATE_KEY, {
        sessionId: sessionRef.current,
        contactDone: done,
        messages: msgs.map(({ id, role, text, options, citations }) => ({
          id,
          role,
          text,
          options,
          citations,
        })),
      });
    },
    [contactDone]
  );

  /**
   * What ChatWidget calls when the panel opens. Does nothing if a conversation is restored.
   *
   * It asks the service for the opener, because the opener depends on the page: a visitor who
   * opens the chat on /health-insurance is standing on that product's page, and asking them
   * which cover they want reads as not having paid attention. They get that funnel's first
   * question instead, and the questions live in one place — the service — rather than being
   * copied into this bundle where they would drift.
   *
   * The old objection to a fetched greeting was that it cost a completion on every panel open,
   * including the ones nobody read. This one is deterministic upstream: no retrieval, no model.
   * A typing indicator while it lands reads as normal in a chat; a wrong greeting does not.
   *
   * GREETING remains as the fallback, so a failed or unconfigured opener costs the page context
   * rather than the conversation.
   */
  const openPanel = useCallback(
    async (force) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setPending(true);
      let opened = null;
      try {
        const res = await fetch(OPENER_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: pageContext() }),
        });
        if (res.ok) opened = await res.json();
      } catch {
        /* falls through to the local greeting */
      }
      const next = opened?.question
        ? [assistantMessage(opened.greeting), assistantMessage(opened.question)]
        : [assistantMessage(GREETING)];
      setMessages((prev) => (!force && prev.length ? prev : (persist(next, force ? false : undefined), next)));
      setPending(false);
      busyRef.current = false;
    },
    [persist]
  );

  const init = useCallback(() => {
    if (messages.length) return;
    openPanel(false);
  }, [messages.length, openPanel]);

  // `replyId` is vestigial — it belonged to the orchestrator's server-declared options. `contact`
  // is live again: `{name, phone, email}` from ContactForm. The RAG buffers every turn of a
  // conversation and pushes the whole thing to the CRM the moment a phone number appears, so
  // these fields are the entire lead-capture mechanism. Sending them on a normal turn is a no-op.
  const send = useCallback(
    async (raw, _replyId = null, contact = null) => {
      const text = String(raw ?? '').trim().slice(0, MAX_MESSAGE_LEN);
      // Not cosmetic: each turn costs an embedding and a completion, and two in flight would
      // interleave in the transcript.
      if (!text || busyRef.current) return;

      busyRef.current = true;
      setError(null);

      // Built before the optimistic append, so it is the turns *before* this question — which
      // is already in `q`. Placeholders and empty bubbles are not context.
      const history = messages
        .filter((m) => !m.streaming && m.text)
        .slice(-HISTORY_TURNS)
        .map((m) => ({ role: m.role, content: m.text }));

      const userMsg = { id: makeId(), role: 'user', text };
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: `${userMsg.id}-r`, role: 'assistant', text: '', streaming: true },
      ]);
      setPending(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const drop = () =>
        setMessages((prev) => {
          const next = prev.filter((m) => m.id !== userMsg.id && m.id !== `${userMsg.id}-r`);
          persist(next);
          return next;
        });

      try {
        const { status, data } = await post(
          {
            q: text,
            history,
            session_id: sessionRef.current,
            // Only present on the contact turn. The RAG cannot create a CRM lead without a
            // phone, so this is the field the whole integration waits on.
            ...(contact?.name ? { name: contact.name } : {}),
            ...(contact?.phone ? { phone: contact.phone } : {}),
            ...(contact?.email ? { email: contact.email } : {}),
            // Attribution, riding in the free-form map the service forwards to the CRM.
            // `landed_from` inside pageContext() is stamped on arrival rather than read live,
            // so a visitor who lands on an ad and opens the chat two pages later still carries
            // the UTMs that paid for them. Nothing consumes it until the contact ask lands, but
            // it costs nothing to send and cannot be reconstructed afterwards.
            data: pageContext(),
          },
          controller.signal
        );

        const read = readAnswer(status, data, PHONE);
        if (read.error) {
          drop();
          setError({ message: read.error, retry: text });
          return;
        }

        setEscalated(read.escalate);
        setReason(read.reason);
        // The contact turn is the last one that needs the form.
        if (contact?.phone) {
          setContactDone(true);
        }

        const answer = assistantMessage(read.answer, read.citations);
        setMessages((prev) => {
          const next = prev.map((m) => (m.id === `${userMsg.id}-r` ? { ...answer, id: m.id } : m));
          persist(next, contact?.phone ? true : undefined);
          return next;
        });
      } catch (err) {
        drop();
        setError({
          message:
            err?.name === 'AbortError'
              ? 'That took too long. Please try again.'
              : 'Please check your connection and try again.',
          retry: text,
        });
      } finally {
        busyRef.current = false;
        setPending(false);
        abortRef.current = null;
      }
    },
    [messages, persist]
  );

  /**
   * Discards the conversation and starts another — including a new session id, so the two are
   * never reported to the CRM as one lead.
   */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    busyRef.current = false;
    setError(null);
    setPending(false);
    sessionRef.current = newSessionId();
    setEscalated(false);
    setReason(null);
    setContactDone(false);
    // Re-fetch rather than seeding the local greeting: starting over on a product page should
    // land on that product's first question again, exactly as opening the panel does.
    setMessages([]);
    openPanel(true);
  }, [openPanel]);

  // Chips come from the last assistant reply. In practice there are none — see
  // assistantMessage — but the path stays live if a reply ever carries a list.
  const last = messages[messages.length - 1];
  const chips =
    last?.role === 'assistant' && !last.streaming && last.options?.length
      ? last.options.map(normalizeOption)
      : null;

  /**
   * Whether to show the contact form.
   *
   * **Never during the funnel.** Contact comes last in this flow — that is the whole point of it:
   * the shortlist earns the phone number rather than gating it. A turn-count trigger alone put
   * the form up in the middle of car qualification, between "where are you with the policy" and
   * "which car is it", which both interrupts the questions and asks for a number before we have
   * shown the visitor anything. The service tells us the stage; `funnel` is a hard veto.
   *
   * What is left is the three moments the form belongs: the shortlist (the assistant has just
   * named plans and asked for a number), an escalation (it has just offered a callback), or a
   * visitor who has asked several questions and never entered a funnel at all.
   *
   * Not while a turn is in flight, not on top of an error, and never again once done.
   */
  const asked = messages.filter((m) => m.role === 'user').length;
  const askContact =
    !contactDone &&
    !pending &&
    !error &&
    !last?.streaming &&
    reason !== 'funnel' &&
    (escalated || reason === 'shortlist' || asked >= CONTACT_AFTER_TURNS);

  return {
    messages,
    pending,
    error,
    send,
    init,
    reset,
    clearError: () => setError(null),
    chips,
    askContact,
    // The visitor closing the form is an answer. Remembered, so it is not asked again.
    dismissContact: () => {
      setContactDone(true);
      persist(messages, true);
    },
    // Retired with the orchestrator: a conversation here has no terminal state, because there
    // is no session to delete. Kept as a constant so ChatPanel's FinishedNotice stays wired up
    // for whatever ends a conversation next, and deliberately NOT restored from storage — a
    // stale `true` in a returning tab would remove the composer for good.
    finished: false,
  };
}
