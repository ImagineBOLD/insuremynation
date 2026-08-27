import { useCallback, useEffect, useRef, useState } from 'react';
import { pageContext, readJSON, writeJSON } from './pageContext';
import { splitOptions } from './splitOptions';

/**
 * Chat state and transport for the imagine.bo orchestrator.
 *
 * Built to HEADLESS_CHAT_INTEGRATION.md. Three endpoints, JSON in and JSON out, called
 * **direct from the browser** — there is no API key in this integration, so unlike the
 * deleted `/v1` proxy there is nothing for our Go service to hold. The widget token
 * ships in the page. What protects the endpoint instead is a domain allowlist on their
 * side, which is why the chat only works on an origin they have listed.
 *
 * What moves to their side with this: the funnel questions, the system prompt, and the lead
 * capture. Their assistant asks for the visitor's contact details itself, so this client
 * must NOT add a contact form of its own anywhere in the flow — the lead is captured either
 * way and the visitor would be asked twice.
 *
 * v2 of the guide moves that ask from the end of the funnel to the second or third turn,
 * and says a visitor who refuses it carries straight on through the questions. **Observed
 * behaviour is still v1** (run 5684 asked for nothing), so it is not something to code
 * against — nothing here needs to change when it lands, because the ask is just another
 * turn of text and we never model whether contact details exist.
 */

const BASE = 'https://orchestrator.imagine.bo';
const TOKEN = 'wgt_slc4VUonB2plFt7lX_JoPzfExlKRe69TGKEbV-ipqzQ';

const REQUEST_TIMEOUT = 60_000;
const MAX_MESSAGE_LEN = 2000;

/** Their idle window is 30 minutes sliding; nothing here needs to track it. */
const STATE_KEY = 'insurenation-chat-state';

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const EMPTY_ANSWER = "I don't have an answer for that. Please try rephrasing.";

/** Status → what the visitor reads. Straight from the integration guide. */
function errorText(status) {
  if (status === 403 || status === 404)
    return 'Chat is unavailable on this page. Please call +91 99101 69789.';
  if (status >= 500)
    return 'The assistant is unavailable right now. Please try again in a moment.';
  return GENERIC_ERROR;
}

/**
 * One POST. Content-Type is the only header allowed: their CORS preflight permits nothing
 * else, so an Authorization header, a tracing header a framework injects, or
 * `credentials: 'include'` all mean the request never arrives.
 */
async function post(path, body, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener('abort', onOuterAbort);
  try {
    const res = await fetch(`${BASE}/widget-proxy/${path}`, {
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
 * An assistant reply, split into the bubble text and any chips it offered.
 *
 * Two sources of chips, one shape. When the server declares real options — id, title,
 * description — those win and the `- ` heuristic is skipped: they are the turn's actual
 * choices, and the id echoed back as `reply_id` is what records a consent tap. The
 * heuristic covers every other turn, whose chips carry no id (`reply_id: null`, i.e. "the
 * visitor typed this").
 */
function assistantMessage(text, serverOptions) {
  if (serverOptions?.length) {
    const options = serverOptions.map((o) => ({
      id: o.id,
      label: o.title,
      description: o.description ?? null,
    }));
    return { id: makeId(), role: 'assistant', text, options };
  }
  const { body, options } = splitOptions(text);
  return {
    id: makeId(),
    role: 'assistant',
    text: body,
    options: options.map((label) => ({ id: null, label, description: null })),
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
  const [finished, setFinished] = useState(() => restored.current?.finished ?? false);

  const tokenRef = useRef(restored.current?.sessionToken ?? null);
  const runRef = useRef(restored.current?.runId ?? null);
  const startedRef = useRef(Boolean(restored.current?.sessionToken));
  const busyRef = useRef(false);
  const abortRef = useRef(null);

  // Abort anything in flight when the component goes away, so a closed tab does not leave
  // a turn running that nobody will read.
  useEffect(() => () => abortRef.current?.abort(), []);

  /**
   * Persisted because there is no history endpoint: the token survives a refresh in
   * sessionStorage but the replies would not, leaving an empty panel over a live session
   * that is good for another 30 minutes.
   */
  const persist = useCallback((msgs, done) => {
    writeJSON(STATE_KEY, {
      sessionToken: tokenRef.current,
      runId: runRef.current,
      messages: msgs.map(({ id, role, text, options }) => ({ id, role, text, options })),
      finished: done,
    });
  }, []);

  /**
   * Mints a session. Called when the visitor opens the panel, never on mount: `init`
   * executes a model turn, so opening on page load would bill every bounce — and an
   * uninvited panel over the hero costs the page the ad paid for anyway.
   *
   * `silent` suppresses the opening message, for the re-init that recovers an expired
   * session mid-conversation. Rendered there it would land *after* the message the visitor
   * has just sent, so the transcript would read: their question, the answer, and then a
   * greeting.
   */
  const start = useCallback(async ({ silent } = {}) => {
    if (startedRef.current || busyRef.current) return;
    startedRef.current = true;
    busyRef.current = true;
    setPending(true);
    try {
      const { status, data } = await post('init', {
        widget_token: TOKEN,
        context_variables: pageContext(),
      });
      if (status !== 200 || !data?.session_token) {
        startedRef.current = false; // let the next open try again
        setError({ message: errorText(status) });
        return;
      }
      tokenRef.current = data.session_token;
      runRef.current = data.run_id ?? null;
      setFinished(false);
      // The only support handle they accept: every conversation is reportable by run_id.
      if (data.run_id) console.info(`[chat] run_id ${data.run_id}`);

      // Documented edge case: `opening_message` can be null — render nothing rather than
      // an empty bubble.
      if (data.opening_message && !silent) {
        setMessages((prev) => {
          const next = [...prev, assistantMessage(data.opening_message, data.options)];
          persist(next, false);
          return next;
        });
      } else {
        setMessages((prev) => {
          persist(prev, false);
          return prev;
        });
      }
    } catch {
      startedRef.current = false;
      setError({ message: 'Please check your connection and try again.' });
    } finally {
      busyRef.current = false;
      setPending(false);
    }
  }, [persist]);

  /** What ChatWidget calls when the panel opens. */
  const init = useCallback(() => start(), [start]);

  const send = useCallback(
    // `replyId` is the tapped option's server id, null when the visitor typed. It has to
    // be echoed: on a consent option the id is what writes the consent row — the title
    // alone reads fine and records nothing. `extra.consent` is the contact form's
    // WhatsApp checkbox, sent as a real boolean on the POST body.
    async (raw, replyId = null, extra) => {
      const text = String(raw ?? '').trim().slice(0, MAX_MESSAGE_LEN);
      const consent = extra?.consent === true ? { consent: true } : {};
      // The guard is not cosmetic: each turn runs a model call, and two in flight
      // interleave and confuse the funnel.
      if (!text || busyRef.current) return;

      busyRef.current = true;
      setError(null);

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
          persist(next, finished);
          return next;
        });

      try {
        // A finished conversation is over server-side, and a fresh one has to exist before
        // this message can go anywhere.
        if (finished || !tokenRef.current) {
          tokenRef.current = null;
          startedRef.current = false;
          busyRef.current = false;
          await start({ silent: true });
          busyRef.current = true;
          if (!tokenRef.current) {
            drop();
            setError({ message: errorText(0), retry: text });
            return;
          }
        }

        let { status, data } = await post(
          'message',
          { session_token: tokenRef.current, text, reply_id: replyId || null, ...consent },
          controller.signal
        );

        // Idled out server-side: start a fresh conversation and resend once, so the
        // visitor sees a pause rather than an error.
        if (status === 200 && data?.session_expired) {
          tokenRef.current = null;
          startedRef.current = false;
          busyRef.current = false;
          await start({ silent: true });
          busyRef.current = true;
          if (!tokenRef.current) {
            drop();
            setError({ message: errorText(0), retry: text });
            return;
          }
          ({ status, data } = await post(
            'message',
            // reply_id dropped: the fresh session never offered that option. The consent
            // boolean survives — it is about the visitor, not the expired session.
            { session_token: tokenRef.current, text, reply_id: null, ...consent },
            controller.signal
          ));
        }

        if (status !== 200) {
          drop();
          setError({ message: errorText(status), retry: text });
          return;
        }

        const answer = assistantMessage(data?.assistant_text || EMPTY_ANSWER, data?.options);
        const done = Boolean(data?.finished);
        if (done) {
          // Terminal: the session is deleted their side. Sending to it again would
          // silently open a second conversation, which means a duplicate lead.
          tokenRef.current = null;
          startedRef.current = false;
          setFinished(true);
        }
        setMessages((prev) => {
          const next = prev.map((m) =>
            m.id === `${userMsg.id}-r` ? { ...answer, id: m.id } : m
          );
          persist(next, done);
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
    [finished, start, persist]
  );

  /** Discards the conversation and opens a new one — also the way out of `finished`. */
  const reset = useCallback(async () => {
    abortRef.current?.abort();
    busyRef.current = false;
    setMessages([]);
    setError(null);
    setPending(false);
    setFinished(false);
    tokenRef.current = null;
    runRef.current = null;
    startedRef.current = false;
    writeJSON(STATE_KEY, null);
    // Not silent: a new chat should open with the greeting, as a first open does.
    await start();
  }, [start]);

  // Chips come from the last assistant reply, so they track whatever question the
  // orchestrator actually asked — nothing on this side has to model the funnel. Each is
  // sent verbatim as the visitor's message: their side normalises "36 to 50" and "my dad
  // is 47" to the same stored value.
  const last = messages[messages.length - 1];
  const chips =
    !finished && last?.role === 'assistant' && !last.streaming && last.options?.length
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
    finished,
  };
}
