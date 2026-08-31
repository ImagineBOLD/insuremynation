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

/** A turn runs retrieval, an embedding call and a completion, and may retry the completion. */
const REQUEST_TIMEOUT = 45_000;
const MAX_MESSAGE_LEN = 2000;

/** Turns of context sent back. Enough for "and what about my wife?", short enough to bill. */
const HISTORY_TURNS = 8;

const STATE_KEY = 'insurenation-chat-state';

/**
 * Local, not fetched. The old opener was a model turn, so every visitor who opened the panel
 * and closed it again cost a completion. There is nothing to ask the service on open, and the
 * panel must not open empty.
 */
const GREETING =
  'Hi! I can answer questions about what our insurers cover — inclusions, exclusions, claims ' +
  'and definitions, from the policy documents themselves. What would you like to know?';

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
 * `splitOptions` is kept as a safety net rather than a working feature. The service is
 * specified never to write a flush column-0 `- ` list, so in practice this finds nothing — but
 * if a reply ever does, the panel behaves the way it always did instead of printing a bare
 * list into a bubble.
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

  // Abort anything in flight when the component goes away, so a closed tab does not leave a
  // turn running that nobody will read.
  useEffect(() => () => abortRef.current?.abort(), []);

  /**
   * The transcript survives a refresh; without this the panel would come back empty in the
   * middle of a conversation, since there is no history endpoint to re-read it from.
   * sessionStorage, not local — people ask this assistant about health conditions.
   */
  const persist = useCallback((msgs) => {
    writeJSON(STATE_KEY, {
      sessionId: sessionRef.current,
      messages: msgs.map(({ id, role, text, options, citations }) => ({
        id,
        role,
        text,
        options,
        citations,
      })),
    });
  }, []);

  /**
   * What ChatWidget calls when the panel opens. No network: it seeds the greeting as a real
   * first message, and does nothing at all if a conversation is already restored.
   */
  const init = useCallback(() => {
    setMessages((prev) => {
      if (prev.length) return prev;
      const next = [assistantMessage(GREETING)];
      persist(next);
      return next;
    });
  }, [persist]);

  // ChatPanel still calls send(text, replyId, extra); the last two are ignored. `reply_id`
  // belonged to the orchestrator's server-declared options and `extra` to the contact form's
  // consent flag — both come back in some form when the contact ask does.
  const send = useCallback(
    async (raw) => {
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

        const answer = assistantMessage(read.answer, read.citations);
        setMessages((prev) => {
          const next = prev.map((m) => (m.id === `${userMsg.id}-r` ? { ...answer, id: m.id } : m));
          persist(next);
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
    const next = [assistantMessage(GREETING)];
    setMessages(next);
    persist(next);
  }, [persist]);

  // Chips come from the last assistant reply. In practice there are none — see
  // assistantMessage — but the path stays live if a reply ever carries a list.
  const last = messages[messages.length - 1];
  const chips =
    last?.role === 'assistant' && !last.streaming && last.options?.length
      ? last.options.map(normalizeOption)
      : null;

  return {
    messages,
    pending,
    error,
    send,
    init,
    reset,
    clearError: () => setError(null),
    chips,
    // Retired with the orchestrator: a conversation here has no terminal state, because there
    // is no session to delete. Kept as a constant so ChatPanel's FinishedNotice stays wired up
    // for whatever ends a conversation next, and deliberately NOT restored from storage — a
    // stale `true` in a returning tab would remove the composer for good.
    finished: false,
  };
}
