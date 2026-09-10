# InsureMyNation

The InsureNation insurance site. Two directories, **one** deployable: the React site is
built and embedded into the Go binary, which serves it. The chat is answered by imagine.bo's
Dograh workflow — the same assistant behind the WhatsApp channel — reached over a same-origin
`/v1/chat/*` that the Go service relays.

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
the Go service too if you want a working chat. **No environment is needed** — every variable
the relay reads defaults to the live value. Note that a local conversation therefore runs
against the *live* workflow, whose own webhook nodes create real leads in the CRM.

| script (in `frontend/`) | what it does |
| --- | --- |
| `npm run dev` | Vite dev server on http://localhost:5173 |
| `npm run build` | production build into `dist/` |
| `npm run preview` | serve the production build |
| `npm run images` | regenerate `public/assets/` from the handoff bundle |
| `node scripts/export-kb.mjs` | regenerate the chatbot's knowledge-base corpus |
| `node scripts/check-contact-ask.mjs` | chat: the contact-ask detector, and the form's validation |
| `node scripts/check-split-options.mjs` | chat: the reply-to-chips parser |
| `node scripts/check-page-context.mjs` | chat: first-seen ad attribution |
| `node scripts/check-emphasis.mjs` | chat: unwrapping `**bold**`, keeping `T&C apply*` |
| `node scripts/check-ask-response.mjs` | chat: answer-or-error — **dormant**, `/v1/ask` is gone |

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

The panel is in `frontend/src/components/chat/`. It posts to a same-origin `POST /v1/chat/init`
and `POST /v1/chat/message`, which `backend/internal/handler/orchestrator.go` relays to
imagine.bo's Dograh workflow. That workflow is the assistant: the funnel, the persona, the
guardrails, the plan-catalogue lookups and the lead capture are all on their side, and the reply
is passed back verbatim so that reshaping it here cannot become a second place for those rules
to drift.

**The relay holds no key.** The widget token is public by design — it used to ship in a script
tag on the page — and what guards their endpoint is an Origin allowlist naming the production
host alone. A browser cannot forge `Origin`; a server can set it. That is the whole reason the
relay exists rather than the panel calling them direct, and it is also why the chat can be
exercised from localhost, which it could not be when the browser made the call itself.

The session is theirs: `init` mints a `session_token` and a `run_id` and returns the opening turn
from the page context, so a visitor on `/health-insurance` is asked that funnel's first question.
It expires, and the hook remints and resends once rather than surfacing an error.

**Leads are the workflow's job**, through its own `Push Lead to CRM` and `Push WhatsApp Consent`
webhook nodes. Nothing in this repo talks to the CRM, so the deploy log here says nothing about
whether a lead landed — check the CRM, or the workflow's run log keyed on `run_id`. The contact
details reach the workflow as prose in the message text, parsed on their side; the phone is the
trigger, as it always was. Every other form on the site is decorative.

| file | job |
| --- | --- |
| `useHeadlessChat.js` | the client: the session token, one turn at a time, reminting, errors |
| `contactAsk.js` | spots their consent sentence, so the form replaces the paragraph |
| `pageContext.js` | which page, and first-seen ad attribution; sent once as `context_variables` |
| `splitOptions.js` | the `- ` lines of a reply become tappable chips, when no `options[]` came |
| `askResponse.js` | answer-or-error — **dormant**, kept for whoever wires the next transport |
| `ChatPanel.jsx`, `Message.jsx`, `ChatWidget.jsx` | the panel, bubbles and launcher |

The checks cover the parts that fail *silently* — a reworded consent sentence takes the contact
form away, a broken parser stops rendering chips, broken attribution reports nothing:

```bash
cd frontend
node scripts/check-contact-ask.mjs
node scripts/check-split-options.mjs
node scripts/check-page-context.mjs
node scripts/check-emphasis.mjs
```

### The origin allowlist

`RAG_ALLOWED_ORIGINS` on the Go service decides which browser origins may call `/v1`, and a
refused one gets `403 {"error":"origin not allowed","origin":"…"}` — the origin is echoed
back, so a missing entry takes one request to diagnose. It exists because every call there
spends a model call upstream, and the service's blanket `Access-Control-Allow-Origin: *` is
right for public pages and wrong in front of that.

There are **two** allowlists in series and this is the outer one. Adding a host here is a
Railway variable; imagine.bo's own list, behind it, is not ours to change — but the relay
attaches the production origin to every outbound call, so it never sees the caller's.
`localhost:5173` needs no entry in either: Vite proxies `/v1`, so the browser call is
same-origin, and the relay presents the production origin upstream. Unset, the middleware fails
open with a startup warning; production must set it. Keep its misleading name — renaming means
a deploy window where the old name is gone and the new one is not yet set, which leaves `/v1`
open to any origin on the internet.

[HEADLESS_CHAT_INTEGRATION.md](HEADLESS_CHAT_INTEGRATION.md) is **not** history: it is the wire
contract for the `/widget-proxy/*` endpoints this relay calls, response shapes and error table
included. Read it before touching `orchestrator.go`.

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
cd backend && go run ./cmd/server
```

No variables needed: all three `ORCHESTRATOR_*` default to the live values. This is worth
knowing because it used to be impossible — while the chat called imagine.bo direct from the
browser, their origin allowlist had no localhost entry, so every turn came back `403` and the
panel said the chat was unavailable. The relay attaches the production origin server-side, so a
dev port never needs allowlisting. The flip side: a local conversation is a **live** one, and
the workflow's webhook nodes will create a real lead if you give the contact form a real number.

### Environment

| var | required | notes |
| --- | --- | --- |
| `CANONICAL_HOST` | recommended | hostname to redirect page requests to, e.g. `insuremynation.imaginebo.app`. Unset, the service answers on any host — and the chat only works on one. `/api/` and `/v1/` are never redirected. |
| `PORT` | no | defaults to `8080` (Railway sets it) |
| `ENV` | no | `production` switches gin to release mode |
| `CLIENT_IP_HEADER` | behind a proxy | header naming the real client. **On Railway set `X-Real-Ip`.** |
| `RAG_ALLOWED_ORIGINS` | **yes in production** | comma-separated browser origins allowed to call `/v1`. Unset, it accepts any origin and logs a warning — and every call there spends a model call upstream. Misleading name, kept deliberately: see *The origin allowlist*. |
| `ORCHESTRATOR_URL` | no | defaults to `https://orchestrator.imagine.bo` |
| `ORCHESTRATOR_WIDGET_TOKEN` | no | defaults to the live token. Public by design, not a secret. |
| `ORCHESTRATOR_ORIGIN` | no | defaults to `https://insuremynation.imaginebo.app` — the origin their allowlist expects, attached to every outbound call regardless of who reached this service. |

**This service holds no secret.** The three `ORCHESTRATOR_*` defaults are the live values on
purpose: none is confidential, and a missing variable that silently disables the chat is a
failure this service has already had. The rule that mattered when it did hold keys still applies
to anything added later — nothing secret may go in a `VITE_*` variable, because that compiles it
into the public bundle. Check the deploy log says `/v1 restricted to N origin(s)` and not
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

**Nothing in this repo reads it, and no file here can reach the chat.** Plan facts come from the
plan catalogue, built from the insurers' own policy wordings and prospectuses, and everything the
assistant may say about the firm is the workflow's `globalNode` persona block — both on
imagine.bo's side. So the matching edit after a copy change is one nobody in this workspace can
make: re-run the script, then ask whoever owns the workflow to update the persona and re-ingest.
Do not assume anything picks it up automatically.
