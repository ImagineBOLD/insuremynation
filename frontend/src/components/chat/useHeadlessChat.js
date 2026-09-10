import { useCallback, useEffect, useRef, useState } from 'react';
import { PHONE } from '../../data/site';
import { isContactAsk } from './contactAsk';
import { pageContext, readJSON, writeJSON } from './pageContext';
import { splitOptions } from './splitOptions';

/**
 * Chat state and transport for the Dograh orchestrator — the same assistant the WhatsApp bot
 * runs, over the same MCP knowledge base, so the two channels cannot answer the same question
 * differently.
 *
 * Two endpoints, same-origin: `POST /v1/chat/init` and `POST /v1/chat/message`, relayed by our
 * Go service. There is no key in this integration — the widget token is public by design. The
 * relay exists because their side gates on the browser's `Origin` header and lists the
 * production host alone: called direct from the browser, as this file used to, the chat is a
 * 403 on every port but one, and could not be exercised locally at all. A server can set Origin;
 * a browser cannot. See backend/internal/handler/orchestrator.go.
 *
 * Two things come back that the RAG transport never had, and both are load-bearing:
 *
 * **A server-issued session.** `session_token` is a real credential with a 30-minute sliding
 * window, minted by `init` and required on every `message`. It is persisted with the transcript,
 * because there is no history endpoint: the token would survive a refresh in sessionStorage but
 * the replies would not, leaving an empty panel over a live conversation.
 *
 * **A terminal state.** `finished` means the session is deleted on their side. Sending to it
 * again silently opens a second conversation, which means a duplicate lead.
 *
 * What is NOT here, because the orchestrator's protocol has no field for it: citations, the
 * structured shortlist, and the funnel's step count. `progress` and `disclosure` are returned as
 * empty so ChatPanel's notice and progress bar render nothing rather than being torn out — the
 * assistant states the disclosure itself, in its opening message.
 *
 * The funnel, the system prompt, the plan lookups and the lead capture all live in the workflow
 * on their side. Their assistant asks for the visitor's contact details itself, so this client
 * must not run an ask of its own: `askContact` only recognises the moment their assistant has
 * already asked, and offers the form as an easier way to type the answer.
 */

const INIT_ENDPOINT = '/v1/chat/init';
const MESSAGE_ENDPOINT = '/v1/chat/message';

/** A turn is a model call on their side, plus a tool call against the MCP server. */
const REQUEST_TIMEOUT = 60_000;
const MAX_MESSAGE_LEN = 2000;

const STATE_KEY = 'insurenation-chat-state';

const GENERIC_ERROR = 'Something went wrong. Please try again.';
const EMPTY_ANSWER = "I don't have an answer for that. Please try rephrasing.";

/**
 * The fallback opener, used when `init` cannot be reached. The real one comes from the workflow
 * and depends on the page: a visitor on /health-insurance is asked that funnel's first question.
 * This one cannot know the page, so it asks, which is the right question with nothing better.
 */
const GREETING =
  "Hi! I'm the InsureNation assistant. I can help with new cover, a renewal, or a claim that " +
  'is stuck.\n\nWhich cover are you looking for?\n' +
  '- Health\n- Life\n- Car\n- Bike\n- Travel\n- Marine (cargo or hull)';

/** Status → what the visitor reads. Straight from HEADLESS_CHAT_INTEGRATION.md. */
function errorText(status) {
  if (status === 403 || status === 404)
    return `Chat is unavailable on this page. Please call ${PHONE}.`;
  if (status >= 500) return 'The assistant is unavailable right now. Please try again in a moment.';
  return GENERIC_ERROR;
}

/** One POST to our own relay. Content-Type is the only header; there is nothing to authorise. */
async function post(endpoint, body, signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener('abort', onOuterAbort);
  try {
    const res = await fetch(endpoint, {
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
 * Two sources of chips, one shape, and the difference is not cosmetic. When the server declares
 * real options — id, title, description — those win and the `- ` heuristic is skipped: they are
 * the turn's actual choices, and the id echoed back as `reply_id` is what records a consent tap.
 * Flatten a declared option set into the text heuristic and every chip carries `id: null`, the
 * tap still looks right, the turn still succeeds, and the WhatsApp consent row is never written.
 * The heuristic covers every other turn, where there is no id to lose.
 */
function assistantMessage(text, serverOptions) {
  const base = { id: makeId(), role: 'assistant', citations: [], plans: [] };
  if (serverOptions?.length) {
    return {
      ...base,
      text,
      options: serverOptions.map((o) => ({
        id: o.id,
        label: o.title,
        description: o.description ?? null,
      })),
    };
  }
  const { body, options } = splitOptions(text);
  return {
    ...base,
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
  const [contactDone, setContactDone] = useState(() => Boolean(restored.current?.contactDone));

  const tokenRef = useRef(restored.current?.sessionToken ?? null);
  const runRef = useRef(restored.current?.runId ?? null);
  const startedRef = useRef(Boolean(restored.current?.sessionToken));
  const busyRef = useRef(false);
  const abortRef = useRef(null);

  // Abort anything in flight when the component goes away, so a closed tab does not leave a turn
  // running that nobody will read.
  useEffect(() => () => abortRef.current?.abort(), []);

  const persist = useCallback((msgs, done = false, contacted = contactDone) => {
    writeJSON(STATE_KEY, {
      sessionToken: tokenRef.current,
      runId: runRef.current,
      finished: done,
      contactDone: contacted,
      messages: msgs.map(({ id, role, text, options }) => ({ id, role, text, options })),
    });
  }, [contactDone]);

  /**
   * Mints a session and renders the opening turn.
   *
   * `silent` suppresses the opening message, for the re-init that recovers an expired session
   * mid-conversation. Rendered there it would land after the message the visitor has just sent,
   * so the transcript would read: their question, the answer, and then a greeting.
   */
  const start = useCallback(
    async ({ silent, force } = {}) => {
      if ((startedRef.current && !force) || busyRef.current) return;
      startedRef.current = true;
      busyRef.current = true;
      setPending(true);
      try {
        const { status, data } = await post(INIT_ENDPOINT, { data: pageContext() });
        if (status !== 200 || !data?.session_token) {
          startedRef.current = false; // let the next open try again
          if (!silent) {
            // Their opener is unreachable, not the whole assistant: seed the local greeting so
            // the panel opens on a question rather than on an apology.
            const next = [assistantMessage(GREETING)];
            setMessages(next);
            persist(next);
          }
          return;
        }
        tokenRef.current = data.session_token;
        runRef.current = data.run_id ?? null;
        setFinished(false);
        // The only support handle they accept: every conversation is reportable by run_id.
        if (data.run_id) console.info(`[chat] run_id ${data.run_id}`);

        // Documented edge case: `opening_message` can be null — render nothing rather than an
        // empty bubble.
        if (data.opening_message && !silent) {
          const next = [assistantMessage(data.opening_message, data.options)];
          setMessages(next);
          persist(next);
        } else {
          setMessages((prev) => {
            persist(prev);
            return prev;
          });
        }
      } catch {
        startedRef.current = false;
        if (!silent) setError({ message: 'Please check your connection and try again.' });
      } finally {
        busyRef.current = false;
        setPending(false);
      }
    },
    [persist]
  );

  /** What ChatWidget calls when the panel opens. Does nothing if a conversation is restored. */
  const init = useCallback(() => {
    if (messages.length) return;
    start();
  }, [messages.length, start]);

  /**
   * `replyId` is the tapped option's server id, null when the visitor typed. It has to be echoed
   * back: on the WhatsApp permission turn the id is what writes the consent record, and the
   * title alone reads correctly and records nothing.
   *
   * `contact` is the form's `{name, phone, email}`. The orchestrator's message endpoint has no
   * fields for them — its assistant asks for contact in prose and reads the reply — so the form
   * submits the formatted text and this argument only tells us not to offer it again.
   */
  const send = useCallback(
    async (raw, replyId = null, contact = null) => {
      const text = String(raw ?? '').trim().slice(0, MAX_MESSAGE_LEN);
      // Not cosmetic: each turn runs a model call, and two in flight interleave and confuse the
      // funnel on their side.
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

      // Mint a session when there is none, or when the last one ended. Wrapped so the two call
      // sites below — the opening case and the expiry retry — cannot drift apart.
      const remint = async () => {
        tokenRef.current = null;
        startedRef.current = false;
        busyRef.current = false;
        await start({ silent: true, force: true });
        busyRef.current = true;
        return Boolean(tokenRef.current);
      };

      try {
        if (finished || !tokenRef.current) {
          if (!(await remint())) {
            drop();
            setError({ message: errorText(0), retry: text });
            return;
          }
          setFinished(false);
        }

        let { status, data } = await post(
          MESSAGE_ENDPOINT,
          { session_token: tokenRef.current, text, reply_id: replyId || null },
          controller.signal
        );

        // Idled out on their side: start a fresh conversation and resend once, so the visitor
        // sees a pause rather than an error.
        if (status === 200 && data?.session_expired) {
          if (!(await remint())) {
            drop();
            setError({ message: errorText(0), retry: text });
            return;
          }
          ({ status, data } = await post(
            MESSAGE_ENDPOINT,
            // reply_id dropped: the fresh session never offered that option.
            { session_token: tokenRef.current, text, reply_id: null },
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
          // Terminal: the session is deleted their side. Sending to it again would silently open
          // a second conversation, which means a duplicate lead.
          tokenRef.current = null;
          startedRef.current = false;
          setFinished(true);
        }
        const contacted = contact?.phone ? true : contactDone;
        if (contact?.phone) setContactDone(true);
        setMessages((prev) => {
          const next = prev.map((m) => (m.id === `${userMsg.id}-r` ? { ...answer, id: m.id } : m));
          persist(next, done, contacted);
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
    [contactDone, finished, persist, start]
  );

  /** Discards the conversation and opens a new one — also the way out of `finished`. */
  const reset = useCallback(async () => {
    abortRef.current?.abort();
    busyRef.current = false;
    setMessages([]);
    setError(null);
    setPending(false);
    setFinished(false);
    setContactDone(false);
    tokenRef.current = null;
    runRef.current = null;
    startedRef.current = false;
    writeJSON(STATE_KEY, null);
    // Not silent: a new chat should open with the greeting, as a first open does.
    await start({ force: true });
  }, [start]);

  const last = messages[messages.length - 1];
  const chips =
    !finished && last?.role === 'assistant' && !last.streaming && last.options?.length
      ? last.options.map(normalizeOption)
      : null;

  /**
   * Whether to show the contact form.
   *
   * Their assistant asks for contact details itself, so this client must never run an ask of its
   * own — the lead is captured either way and the visitor would be asked twice. What is left is
   * recognising the turn where they have just asked, and offering fields instead of a paragraph.
   * `isContactAsk` matches their consent sentence, which is prose only their workflow writes.
   */
  const askContact =
    !contactDone &&
    !finished &&
    !pending &&
    !error &&
    !last?.streaming &&
    last?.role === 'assistant' &&
    isContactAsk(last?.text);

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
    dismissContact: () => {
      setContactDone(true);
      persist(messages, finished, true);
    },
    finished,
    // No equivalent in this protocol. Returned so ChatPanel's progress bar and standing notice
    // stay wired for whatever supplies them next: both render nothing when empty, and the
    // assistant states the disclosure itself in its opening message.
    progress: null,
    disclosure: null,
  };
}
