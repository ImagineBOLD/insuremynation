# InsureMyNation

The InsureNation insurance site. Two directories, **one** deployable: the React site is
built and embedded into the Go binary, which serves it. The chat answers from our own corpus
RAG over a same-origin `/v1/ask` that the Go service proxies.

Live at **https://insuremynation.imaginebo.app** — the canonical host.

```
frontend/   React site (Vite + React 18 + React Router 6 + Framer Motion) + the chat panel
backend/    Go service — static host for the built site, plus a healthcheck
Dockerfile  builds both, at the repo root because it needs both directories
```

This is the only `README.md` in the repo; `CLAUDE.md`, `.gitignore` and `.gitattributes`
are likewise single and at the root. `frontend/` used to carry its own copies of the first
two; both were removed and that removal is pushed, so a pull will not bring them back.

## Running locally

```bash
cd frontend && npm install && npm run dev      # http://localhost:5173
cd backend  && go run ./cmd/server             # http://localhost:8080
```

`npm run dev` alone covers frontend work, and Vite forwards `/v1` to `localhost:8080`, so run
the Go service too — with `RAG_URL` and `RAG_API_KEY` set — if you want a working chat.

| script (in `frontend/`) | what it does |
| --- | --- |
| `npm run dev` | Vite dev server on http://localhost:5173 |
| `npm run build` | production build into `dist/` |
| `npm run preview` | serve the production build |
| `npm run images` | regenerate `public/assets/` from the handoff bundle |
| `node scripts/export-kb.mjs` | regenerate the chatbot's knowledge-base corpus |
| `node scripts/check-split-options.mjs` | chat: the reply-to-chips parser |
| `node scripts/check-page-context.mjs` | chat: first-seen ad attribution |
| `node scripts/check-ask-response.mjs` | chat: answer-or-error, per `/v1/ask` response |

In `backend/`: `go build ./...`, `go vet ./...`, `go test ./...`.

# The frontend

React port of the InsureNation design handoff. The visual design is reproduced exactly: no
colour, image, copy or spacing value was changed.

## Routes

| path | source design file |
| --- | --- |
| `/` | InsureNation Landing |
| `/about` | InsureNation About |
| `/career` | InsureNation Career |
| `/claim-support` | InsureNation Claim Support |
| `/contact` | InsureNation Contact |
| `/health-insurance` | InsureNation Health Insurance |
| `/life-insurance` | InsureNation Life Insurance |
| `/car-insurance` | InsureNation Car Insurance |
| `/bike-insurance` | InsureNation Bike Insurance |
| `/travel-insurance` | InsureNation Travel Insurance |
| `/marine-insurance` | InsureNation Marine Insurance |

## Structure

```
public/assets/        WebP artwork + the SVG icons
scripts/
  convert-images.mjs  handoff PNG/JPG -> WebP
  export-kb.mjs       site copy -> chatbot knowledge-base corpus
src/
  components/         Nav, Footer, Partners, TalkToExperts, Icons,
                      Primitives (Eyebrow/SplitHeading/Body/Field/...),
                      Reveal (scroll-animation primitives)
  data/
    site.js           shared contact details, nav + partner lists
    products.js       per-product copy for the six insurance pages
  pages/              Landing, About, Career, ClaimSupport, Contact,
                      InsurancePage
  styles/
    global.css        base rules + every responsive breakpoint from the design
    components.css    hover/focus states the prototype expressed inline
```

## How the design is preserved

The prototype sizes everything with inline styles against a 1728px canvas, then reshapes it
through `[data-r="..."]` media queries. That structure is kept:

- Element styles stay inline, matching the source values one-for-one.
- Every `@media` block is reproduced verbatim in `src/styles/global.css`.
- Because all pages share one CSS bundle and several `data-r` names mean different things
  per page (`badge`, `srow`, `stitle`, `cimg`, `cgrid`), page-specific blocks are scoped by
  a root class — `.p-landing`, `.p-about`, `.p-sub` — plus two narrower hooks:
  `.p-sub[data-product="health"]` for the Health cover artwork and
  `.p-sub[data-page="contact"]` for the details grid.

## Images

`npm run images` converts the raster assets with sharp and copies the SVG icons unchanged.

The handoff's hero and cover-art photos carried a blue gradient-map treatment. Those have
since been **replaced with natural photography, so no image in `public/assets/` is
duotoned.** `scripts/blue-duotone-lut.json` is that treatment recovered from the handoff,
and `duotone: true` in `scripts/convert-images.mjs` still applies it, but no entry sets the
flag — both are kept only in case a treated image has to be rebuilt from raw source.

The natural replacements were encoded from stock PNGs that are no longer in the tree, at
the pixel dimensions of the duotoned files they replaced, so framing matches. They are
lossy WebP (q90) rather than the lossless q100 the rest of `public/assets/` uses, and
`npm run images` will not reproduce them.

## Animation

Interactions carried over from the prototype: the hero photo collage crossfade and headline
rotation, the services and building-block hover rows, the testimonial rail, the nav
dropdown, and the form submit-state transitions.

The insurance pages add scroll-triggered motion via Framer Motion
(`src/components/Reveal.jsx`), reusing the design's own easing curve
`cubic-bezier(0.22, 1, 0.36, 1)`. Every animated element settles at exactly the position,
scale and colour the design specifies, so the page at rest is unchanged.
`prefers-reduced-motion` collapses all of it.

# The chat

The panel is in `frontend/src/components/chat/`. It posts to a same-origin `POST /v1/ask`,
which the Go service forwards to our corpus RAG with a bearer token the browser never sees —
110,307 passages from 4,057 insurer documents, so it answers clause-level questions
(exclusions, claims procedure, definitions) that the old marketing-copy knowledge base could
not. Each answer comes back with up to four citations naming a real insurer document, linked
to the insurer's own PDF.

The service is stateless: no session token, no cookies. `history` is sent from the browser
every turn, so a restart or a second replica cannot lose a conversation.

**It captures no leads.** It replaced imagine.bo's orchestrator, which ran the funnel and
asked the visitor for name, mobile and email itself, and nothing on this side asks yet —
every other form on the site is decorative. `ContactForm.jsx`, `contactAsk.js` and
`countries.js` are parked in the tree for that next change; `session_id` and `data` already
go out on every request so the RAG can report the lead the moment a phone number does.

| file | job |
| --- | --- |
| `useHeadlessChat.js` | the client: one turn at a time, history, errors |
| `askResponse.js` | answer-or-error, per response — an `answer` is an answer whatever the status |
| `pageContext.js` | which page, and first-seen ad attribution; sent as `data` |
| `splitOptions.js` | the `- ` lines of a reply become tappable chips (a safety net now — the service never writes one) |
| `ChatPanel.jsx`, `Message.jsx`, `ChatWidget.jsx` | the panel, bubbles, citations and launcher |

Three checks cover the parts that fail *silently* — a broken parser just stops rendering
chips, broken attribution just reports nothing, and a misread response turns a polite
escalation into a red error box:

```bash
cd frontend
node scripts/check-split-options.mjs
node scripts/check-page-context.mjs
node scripts/check-ask-response.mjs
```

### The origin allowlist

`RAG_ALLOWED_ORIGINS` on the Go service decides which browser origins may call `/v1`, and a
refused one gets `403 {"error":"origin not allowed","origin":"…"}` — the origin is echoed
back, so a missing entry takes one request to diagnose. It exists because every call there
spends money on an embedding and a completion, and the service's blanket
`Access-Control-Allow-Origin: *` is right for public pages and wrong in front of that.

This is ours now, not imagine.bo's. Adding a host is a Railway variable rather than a request
to someone else, and `localhost:5173` needs no entry at all — Vite proxies `/v1` so the call
is same-origin. Unset, the middleware fails open with a startup warning; production must set
it. [HEADLESS_CHAT_INTEGRATION.md](HEADLESS_CHAT_INTEGRATION.md) documents the orchestrator
the site used to call, and is kept for history only.

### Mobile

Below 560px the panel becomes a full-screen sheet (`chat.css`). Four of those rules exist
for reasons a desktop browser will not show you:

- the height is set from `window.visualViewport` in JS, because `inset: 0` is the layout
  viewport and an on-screen keyboard does not shrink it — the composer would end up
  *under* the keyboard. `100dvh` tracks browser chrome, not keyboards.
- the composer is 16px, below which iOS Safari zooms the page on focus and the visitor
  cannot zoom back out.
- the launcher is hidden while the panel is open, or it covers the send button.
- the composer is not auto-focused on touch, or the keyboard hides the question.

# The service

One binary: the built React app is embedded via `//go:embed`
(`backend/internal/fs.go`) and served as a SPA, plus `GET /api/health` for the Railway
healthcheck. Nothing else.

### Build and deploy

The `Dockerfile` and `railway.toml` live at the **repository root**, not in `backend/`,
because the build has to reach both `frontend/` and `backend/`. On Railway leave the
service's Root Directory empty so the build context is the repo root.

The image builds the site (`node:22-alpine`, `npm ci && npm run build`), overlays the
output onto `backend/internal/dist`, then compiles the Go binary with it embedded. Only a
placeholder `backend/internal/dist/index.html` is committed — enough for `//go:embed` to
compile from a clean checkout.

To reproduce locally:

```bash
cd frontend && npm run build
cd ../backend && rm -rf internal/dist && cp -r ../frontend/dist internal/dist
go build -o bin/imagine_backend ./cmd/server && ./bin/imagine_backend
```

For day-to-day frontend work use `npm run dev`. `vite.config.js` forwards `/v1` to
`localhost:8080`, so run the Go service alongside it if you want the chat:

```bash
cd backend && RAG_URL=https://insurenation-rag-production.up.railway.app RAG_API_KEY=… go run ./cmd/server
```

This is newer than it looks. While the chat called imagine.bo direct from the browser it
could not be exercised locally at all — their origin allowlist has no localhost entry, so
every turn came back `403` and the panel said the chat was unavailable. It is our own
service now, and nothing has to allowlist a dev port.

### Environment

| var | required | notes |
| --- | --- | --- |
| `CANONICAL_HOST` | recommended | hostname to redirect page requests to, e.g. `insuremynation.imaginebo.app`. Unset, the service answers on any host — and the chat only works on one. `/api/` and `/v1/` are never redirected. |
| `PORT` | no | defaults to `8080` (Railway sets it) |
| `ENV` | no | `production` switches gin to release mode |
| `CLIENT_IP_HEADER` | behind a proxy | header naming the real client. **On Railway set `X-Real-Ip`.** |
| `RAG_URL` | **yes** | the corpus RAG service, `https://insurenation-rag-production.up.railway.app`. Unset, `/v1/ask` answers 503 with a "call us" message. |
| `RAG_API_KEY` | **yes** | bearer token for that service — the same string it holds itself. Read it off the `insurenation-rag` service; never put it in a `VITE_*` variable, which compiles into the public bundle. |
| `RAG_ALLOWED_ORIGINS` | **yes in production** | comma-separated browser origins allowed to call `/v1`. Unset, it accepts any origin and logs a warning — and every call there costs an embedding and a completion. |

Those three are the whole reason `/v1/ask` exists. The chat used to call imagine.bo direct
from the browser with a public widget token, so there was no key for this service to hold and
the proxy was deleted; the corpus RAG does have one, and a Vite build cannot keep a secret.
Check the deploy log says `/v1 restricted to N origin(s)` and not
`WARN: RAG_ALLOWED_ORIGINS is unset`.

`CLIENT_IP_HEADER` still feeds the global rate limiter, and the value must be a header the
edge **overwrites**, not merely one that sounds infrastructural. Naming a header the edge
does not set is worse than leaving this blank: every caller can then supply it and
impersonate any client.

Measured against this Railway deployment:

| header | set by Railway? | forged value |
| --- | --- | --- |
| `X-Real-Ip` | yes | replaced with the true client IP — **safe** |
| `X-Forwarded-For` | yes, real client **first**, edge appended | left entry is caller-controlled |
| `X-Envoy-External-Address` | **no** | accepted verbatim — unsafe despite the name |

Re-run that check on any new platform (send the header a value, see whether it survives)
rather than trusting a name. gin's default of trusting `X-Forwarded-For` from any peer is
disabled in `server.go`: before that fix, 12 forged requests bought 12 fresh quotas.

Variables are read with `os.Getenv`, so setting a missing one and restarting is enough —
there is no `.env` loading and no config struct to extend.

```bash
CANONICAL_HOST= ENV=development go run ./cmd/server
go test ./...
```

### The knowledge base

`frontend/kb-corpus.txt` is generated from the site's own copy by
`frontend/scripts/export-kb.mjs`, so the assistant cannot drift from what the site says.
Re-run it after any copy change:

```bash
cd frontend && node scripts/export-kb.mjs
```

**The website chat no longer reads it.** Answers come from the corpus RAG, whose 4,057
documents are the insurers' own — policy wordings and prospectuses, not our marketing copy.
The file is kept because it is still how this site's copy reaches a knowledge base at all,
and the dograh workflow (the voice channel, and the three root JSONs) is a separate
integration that may still be ingesting it. Re-run the script after a copy change and ask
whoever owns that side to re-ingest; do not assume anything picks it up automatically.
