/**
 * Where the visitor is, and where they came from.
 *
 * This used to be the orchestrator's `context_variables`, which opened the funnel on the
 * right product. There is no funnel any more, and it earns its place for the other half of
 * what it always carried: it goes out as `data` on every `/v1/ask`, which is the map the RAG
 * forwards to the CRM on the lead. Nothing reads it until the contact ask is rebuilt on this
 * side — but attribution cannot be reconstructed after the fact, so it is sent from the
 * first turn rather than switched on later.
 *
 * Its own module, apart from the hook, so it can be exercised without React: `landing()`
 * is the one piece of state here that is wrong in a way nobody would notice until the
 * campaign reporting came back empty.
 */

const LANDING_KEY = 'insurenation-chat-landing';

/**
 * sessionStorage, not localStorage. For the transcript that is privacy — people ask this
 * assistant about health conditions and money, and localStorage hands the last visitor's
 * conversation to the next person on a shared machine. For the session token it is the
 * integration guide's instruction: it is a bearer token for one conversation.
 */
export const store = () => (typeof window === 'undefined' ? null : window.sessionStorage);

export function readJSON(key) {
  try {
    const raw = store()?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null; // private mode, or something that is not ours in our key
  }
}

export function writeJSON(key, value) {
  try {
    if (value == null) store()?.removeItem(key);
    else store()?.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode — the conversation still works, it just will not survive a refresh */
  }
}

/**
 * The query string and referrer the visitor **arrived** with, stamped once per tab.
 *
 * This is the whole attribution story and it is easy to get wrong. They land on
 * /health-insurance?utm_source=google, browse to /about, and only then open the chat — by
 * which point the UTMs are gone from the URL. Read live instead of stamped, `landed_from`
 * would come back empty on exactly the journeys worth measuring, and there would be nothing
 * tying a closed policy to the ad that paid for it.
 */
export function landing() {
  const stored = readJSON(LANDING_KEY);
  if (stored) return stored;
  const fresh = {
    landed_from: window.location.search.replace(/^\?/, ''),
    referrer: document.referrer || '',
  };
  writeJSON(LANDING_KEY, fresh);
  return fresh;
}

/**
 * `product` is only the query parameter, for a home-page ad landing (/?product=health); the
 * pathname carries the rest.
 *
 * Every value is a string, which is not incidental — the Go proxy binds this as
 * `map[string]string` (`backend/internal/handler/ask.go`) and a number or a boolean added
 * here would fail the bind and 400 the whole turn, not just drop the field.
 */
export function pageContext() {
  return {
    page: window.location.pathname || '/',
    product: new URLSearchParams(window.location.search).get('product') || '',
    page_title: document.title || '',
    ...landing(),
  };
}
