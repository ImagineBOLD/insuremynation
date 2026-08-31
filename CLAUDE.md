# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Layout

Two directories, **one** deployable.

| path | what |
| --- | --- |
| `frontend/` | the React site (Vite + React 18 + React Router 6 + Framer Motion) |
| `backend/` | Go service: serves the built site from an embedded filesystem, plus the `/v1/ask` chat proxy |

Plus, at the root, three JSON files that are part of **neither** build: they are exports of
the imagine.bo/dograh chat workflow. See *The funnel* below — their filenames mislead.

This file is the **only** `CLAUDE.md` in the repo, and `README.md`, `.gitignore` and
`.gitattributes` are likewise single and at the root. Do not re-add per-directory copies.
`frontend/` used to carry its own `CLAUDE.md` and `README.md`; both were removed and that
removal is pushed, so a pull will not bring them back. If upstream ever re-adds one, fold
its content in here and delete it again rather than keeping two.

The `Dockerfile` and `railway.toml` are at the **repo root**, not in `backend/`, because
the build needs both directories: it builds the site with npm, embeds the output into the
Go binary via `//go:embed` (`backend/internal/fs.go`), and ships one container. On Railway
leave the service's Root Directory empty so the build context is the repo root.

Deployed at **https://insuremynation.imaginebo.app** — the canonical host, and still the only
one whose chat works, though the reason has changed. It used to be imagine.bo enforcing a
domain allowlist we did not control; it is now `RAG_ALLOWED_ORIGINS` on our own service, and
that variable lists this domain alone. The Railway subdomain
(`insuremynation-production.up.railway.app`) still answers and serves the same build, but its
chat gets `403 {"error":"origin not allowed"}` — a page that looks fine above a dead
assistant. `CANONICAL_HOST` makes the service redirect page requests to the custom domain;
see `canonicalHost` in `server.go`. Point ads there. Adding an origin is now a Railway
variable rather than a request to someone else, but it is still a step: an unlisted host gets
a 403 the same way. A dev port is the exception — Vite proxies `/v1`, so `localhost:5173` is
same-origin and needs no entry.

Everything here is on GitHub, `backend/` and the deploy files included. Upstream authors
the site itself, so when pulling expect it to own `frontend/src/pages`,
`frontend/src/data`, `frontend/src/styles` and `frontend/public`. The chat is ours and
lives in `frontend/src/components/chat/`. The only local edits outside that directory are the
`<ChatWidget/>` mount in `App.jsx` and, in `frontend/index.html`, the **deleted reCAPTCHA v3
loader** — a WordPress leftover for a Contact Form 7 form this build does not have, whose only
effect was Google's floating badge in the bottom-right corner, behind the chat panel. Nothing
reads `grecaptcha`. A pull that restores it brings the badge back; delete it again.

`frontend/index.html` is otherwise upstream's, and its head is now mostly marketing tags:
**three** GTM containers (`GTM-PNX2KL6`, `GTM-5CMDJ73Z`, `GTM-N2D4SQ9W`), a Google Ads
`gtag` (`AW-16945755026`) and a Meta Pixel (`452243449957607`), each GTM with a
`<noscript>` twin in the body. Three containers on one page is more likely a duplicate than
a plan — ask whoever runs the ad accounts before adding a fourth or removing one, and expect
pulls to touch this block. Everything below them (the font preconnect/preload, the
conditional `landing-hero.webp` preload on `/`) is performance work; leave it.

## Commands

All `npm` commands run from `frontend/`; all `go` commands from `backend/`.

```bash
npm run dev              # Vite dev server on http://localhost:5173
npm run build            # production build into frontend/dist/
npm run preview          # serve the production build
npm run images           # regenerate public/assets/ from the design handoff bundle
npm run images:optimize  # re-encode what is already in public/assets/ (scripts/optimize-images.mjs)
node scripts/export-kb.mjs   # regenerate kb-corpus.txt from the site's own copy

node scripts/check-ask-response.mjs    # chat: answer-or-error, per /v1/ask response
node scripts/check-split-options.mjs   # chat: the reply-to-chips parser
node scripts/check-page-context.mjs    # chat: first-seen landed_from / referrer
node scripts/check-contact-ask.mjs     # chat: the contact form's validation (half dormant)
node scripts/check-emphasis.mjs        # chat: unwrapping **bold**, keeping "T&C apply*"

go build ./... && go vet ./... && go test ./...
go run ./cmd/server      # serves the committed *placeholder* dist, not a real site build
```

From the repo root:

```bash
make deploy              # railway up --service insuremynation --ci
```

There is no lint or test framework in the frontend and it does not need one. The
`scripts/check-*.mjs` files are plain `node` + `assert` and cover the pieces of the chat
client that fail *silently* — a misread response turns a polite escalation into a red error
box (or a wrong API key into an assistant with nothing to say), a broken parser stops
rendering chips or eats the text it mistook for a menu, broken attribution reports nothing,
and a broken emphasis unwrap leaks asterisks or swallows a footnote marker. Run them after
touching any of it. `check-contact-ask.mjs` is half dormant — see *The contact ask, when it
comes back*. Everything else in the frontend is verified visually; the backend has build, vet
and test.

## The frontend

A pixel-exact React port of the InsureNation design handoff. The prime directive: **the
visual design is reproduced exactly** — no colour, image, copy or spacing value may drift
from the handoff. Preserve this when editing.

### Styling model (the non-obvious part)

The design prototype sizes everything with inline styles against a 1728px canvas and
reshapes it through `[data-r="..."]` media queries. That structure is kept intact:

- **Element styles are inline in JSX**, matching the source design values one-for-one. Do
  not extract them to CSS classes.
- **All responsive behaviour lives in `src/styles/global.css`**, as `@media` blocks
  targeting `data-r` attribute names, reproduced verbatim from the design.
- All pages share one CSS bundle, and several `data-r` names mean **different things per
  page** (`badge`, `srow`, `stitle`, `cimg`, `cgrid`). Page-specific media-query blocks are
  therefore scoped by a root class on each page: `.p-landing`, `.p-about`, `.p-sub`, plus
  `.p-sub[data-product="health"]` and `.p-sub[data-page="contact"]`. When adding a `data-r`
  name, check `global.css` for collisions with other pages.
- `src/styles/components.css` holds hover/focus states the prototype expressed inline.

### Routing and data

- `src/App.jsx` defines all routes. The six insurance pages (`/health-insurance`,
  `/life-insurance`, …) are one component, `src/pages/InsurancePage.jsx`, driven by
  per-product config in `src/data/products.js`. The `key={product.slug}` on the element
  (not just the Route) is load-bearing — without it React reuses the instance across
  product navigations, breaking scroll reveals and leaking form state.
- `src/data/site.js` holds shared constants: brand colours (`BLUE`, `DEEP`, `RED`), contact
  details, nav links, partner list. Use these instead of hard-coding.

### Shared components

- `src/components/Primitives.jsx` — typography/layout primitives (`Eyebrow`,
  `SplitHeading`, `Body`, `Field`, …) used on every page.
- `src/components/Reveal.jsx` — scroll-triggered entrance animation primitives. All motion
  uses the design's easing `cubic-bezier(0.22, 1, 0.36, 1)` (exported as `EASE`); do not
  introduce other easings. Reveals arm 400px below the fold so content never appears blank
  while being read; stagger/duration ceilings are enforced inside the primitives.
  `prefers-reduced-motion` disables all entrance animation. Animated elements must settle
  at exactly the position/scale/colour the design specifies.

### Images

- `public/assets/` is generated output (WebP + SVG icons) — regenerate via `npm run images`
  rather than editing files by hand.
- The handoff's hero and cover-art photos carried a blue gradient-map treatment. These have
  since been **replaced with natural photography, so no image in `public/assets/` is
  duotoned.** `scripts/blue-duotone-lut.json` is that treatment recovered from the handoff
  and `duotone: true` in `scripts/convert-images.mjs` still applies it, but no entry sets
  the flag — both are kept only in case a treated image has to be rebuilt from raw source.
- The natural replacements were encoded from stock PNGs no longer in the tree, at the pixel
  dimensions of the duotoned files they replaced, so framing matches. They are lossy WebP
  (q90) rather than the lossless q100 the rest of `public/assets/` uses, and `npm run
  images` will not reproduce them.

## The chat

**The panel is ours; the answers come from our own corpus RAG.** `useHeadlessChat.js` posts to
a same-origin `POST /v1/ask`, which `backend/internal/handler/ask.go` forwards to
`insurenation-rag-production.up.railway.app` with a bearer token. The browser never sees a
credential, and that is the whole reason the proxy exists: this is a Vite build, so anything in
a `VITE_*` variable is compiled into the public bundle and is not a secret.

That proxy was deleted once, and it is back for exactly the reason its deletion note gave. The
previous integration — imagine.bo's orchestrator, called **direct from the browser** with a
public widget token — carried no key to hide, so there was nothing for a Go service to hold.
The corpus RAG carries one. `HEADLESS_CHAT_INTEGRATION.md` and the three root workflow JSONs
describe that older integration and are kept for history; the site no longer calls it, and
`git log` has the funnel-in-`journeys.js` version before that.

Behind `/v1/ask`: 110,307 passages from 4,057 insurer documents across 19 insurers — policy
wordings, prospectuses, Customer Information Sheets. The guardrails are **server-side** and
must not be re-implemented here: ~600 characters of plain text, no premiums or waiting-period
durations, insurers we do not place refused by name, and an escalation rather than a guess.

What is left, and what each piece is for:

| file | job |
| --- | --- |
| `useHeadlessChat.js` | the client: one turn at a time, history from React state, errors |
| `askResponse.js` | answer-or-error for one response, and the visitor-facing error strings |
| `pageContext.js` | which page, and first-seen ad attribution — sent as the `data` map |
| `splitOptions.js` | turns the column-0 `- ` lines of a reply into chips |
| `unwrapEmphasis.js` | drops paired `**`/`__` so the bubble does not show asterisks |
| `contactAsk.js` / `ContactForm.jsx` / `countries.js` | the contact turn as fields instead of a paragraph — **parked, see below** |
| `ChatPanel.jsx` / `Message.jsx` | the panel and bubbles, per the WhatsApp-style design; `Message` also renders citations |
| `ChatWidget.jsx` | launcher, open/close, Escape |
| `RobotGlyph.jsx` | the handoff's `chatbot.svg` as inline JSX — launcher (white), header (brand blue) |

Seven things that are easy to get wrong:

- **The chat captures no leads.** The orchestrator ran a funnel and asked for name, mobile and
  email itself; ours answers questions and asks for nothing, and every other form on the site is
  `onClick={() => setSent(true)}` with no fetch. So the website channel currently produces
  **zero** CRM leads, deliberately, until the contact ask is rebuilt on this side. That is why
  `contactAsk.js`, `ContactForm.jsx`, `countries.js` and `check-contact-ask.mjs` are still in
  the tree, and why `session_id` and `data` already ride on every request: the RAG buffers a
  conversation and reports it the moment a phone number appears. Do not read the empty tree as
  "leads were never here", and do not treat the flat CRM number as a broken integration.
- **An `answer` is an answer whatever the status code** (`askResponse.js`). The Go proxy's own
  502 and 503 bodies carry customer-safe wording plus `escalate: true`, and `escalate` on a 200
  is the assistant declining to guess — a normal reply. Only a response with **no** `answer` is
  an error, which is what an upstream 401 from a wrong key looks like, since `ask.go` relays it
  verbatim. Get this backwards and either a polite escalation renders as a red error box or a
  real failure renders as an answer. `node scripts/check-ask-response.mjs` pins all four
  branches. Two of its strings are load-bearing: `ErrorNotice` matches `/too many/i` to suppress
  its "you can also call us" footer, and any message naming the number must use `PHONE` from
  `data/site.js` verbatim or the notice prints it twice.
- **The origin allowlist is ours now.** `RAG_ALLOWED_ORIGINS` on the Go service, not a list
  someone else keeps — a refused origin gets `403 {"error":"origin not allowed","origin":"…"}`
  with the origin echoed back. It guards an endpoint that spends an embedding and a completion
  per call. Unset, it **fails open** with a startup warning, so check the deploy log says
  `/v1 restricted to N origin(s)`. `localhost:5173` needs no entry: `vite.config.js` proxies
  `/v1` to `:8080`, so the call is same-origin — **the chat is testable locally for the first
  time**, which it never was under the orchestrator.
- **`landed_from` and `referrer` are first-seen, not current** (`pageContext.js`). A visitor
  lands on `/health-insurance?utm_source=google`, browses to `/about`, then opens the chat —
  read live, the UTMs are already gone and the attribution is empty on exactly the journeys
  worth measuring. It goes out as `data`, which `ask.go` binds as `map[string]string` and
  forwards to the CRM, so every value there must be a string or the whole turn 400s.
  `node scripts/check-page-context.mjs` covers the stamping.
- **Chips are a safety net, not a feature.** `splitOptions.js` still runs on every reply, taking
  the last contiguous run of `- ` lines **at column 0** — indentation is the test that separates
  a menu from a nested fact, and `node scripts/check-split-options.mjs` pins the shape against a
  real orchestrator opener. But the corpus service is specified never to write a flush dash
  list, so in practice this finds nothing and no chip is ever rendered. `ChatPanel`'s funnel
  shortcuts ("Change policy type", "Request callback") hang off the same dead path. Leave both;
  they cost nothing and cover a reply that ever does carry a list.
- **Citations are safe to show, and did not used to be.** `Message.jsx` renders `doc_title` per
  citation, linked to the insurer's own PDF. The comment that stood in that slot explained why
  there was no citation line: the knowledge base was one generated file, so the only nameable
  source was `insuremynation-website.txt`, an internal build artefact. A citation now names a
  real insurer document. `restricted` gets no badge — it only means we do not quote premiums
  from that document, and saying so invites the question the guardrail exists to avoid.
- **`Message.jsx` renders text as a child, never `innerHTML`**, with `pre-wrap`: replies carry
  newlines and are explicitly not markdown, so nothing must run them through a renderer. The
  model writes `**Cover**` regardless of what the prompt forbids, so `unwrapEmphasis.js`
  strips **paired** `**`/`__` before rendering — paired only, because insurance copy ends with
  a footnote marker ("T&C apply\*") that has to survive. Do **not** reach for a markdown
  library instead: besides the dependency, it would render the `- ` lines as an HTML list and
  `splitOptions` would never see them again. The transform runs on assistant text only; the
  visitor's own words are echoed exactly as typed.

Two things that went away with the orchestrator, so that a reader of older code knows they are
gone rather than broken: there is **no server-issued session** (no token, no `reply_id`, no
`session_expired` resend — `history` is sent from React state every turn and the service stores
nothing), and there is **no terminal state**. `finished` is a constant `false`; `FinishedNotice`
is left wired for whatever ends a conversation next. It is deliberately not restored from
storage, because a stale `true` in a returning tab would remove the composer for good.

### The contact ask, when it comes back

Not built yet. When it is: trigger `ContactForm` from **our** state — `escalate: true`, or a
fallback after a few substantive turns — never from the assistant's wording. `isContactAsk()`
matches the orchestrator's consent sentence, prose the corpus service never writes, so it is
dormant and its half of `check-contact-ask.mjs` is dormant with it. `formatContact` and
`contactError` in the same file are **not** dormant: `ContactForm.jsx` imports both.

`ContactForm` submits formatted text today and needs one extra argument to hand back the
structured `{name, dial, phone, email}`; `ChatPanel`'s `submit` already forwards a second
argument, and `ask.go` already relays `phone`, `name`, `email` and `data`. Nothing in the Go
service has to change. There is **no consent checkbox** on the form despite what older notes
say — the orchestrator asked that permission itself, one turn later, as server-declared buttons.

### The funnel

**The website no longer runs this**, and that is the first thing to know before reading it. The
funnel belonged to the orchestrator the chat used to call; the corpus RAG that replaced it asks
no questions. The workflow is still live on imagine.bo's side for their other channels, and the
exports are still ours to version, so the files stay — but nothing described below reaches a
visitor through this repo any more.

The three root JSONs are exports of one dograh/imagine.bo workflow,
`InsureNation (Website Chatbot) - Leads` — 22 nodes, and despite the filename **none of them
holds lead data**:

- `startCall` S0 Welcome & Router → `agentNode` S1 Answer & Triage → S1b Contact & Consent
  (early) → S1c WhatsApp Permission → the six per-product qualifications F1 Health … F6 Marine,
  plus R1 Renewal, C1 Support & Claims, C2 Careers → S2 Summary & Callback Offer → S4 Callback
  Confirm → `endCall` E1 Callback Confirmed / E2 Handover / E3 Graceful Close. Two `webhook`
  nodes (Push Lead to CRM, Push WhatsApp Consent) and one `qa` node hang off it.
- The `globalNode` "Persona + Ground Truth" is the system prompt — the no-premiums,
  no-waiting-periods, never-re-ask rules the assistant is held to. Read it before assuming the
  bot "should" answer something; most of what it declines, it declines on purpose.
- **Newest wins.** `InsureNation-workflow-mcp.json` (commit `adc96e0`) is current: it is the
  only one whose agent nodes carry `tool_uuids: ["<UUID:kb_mcp>"]`, i.e. the knowledge base
  reached as an MCP tool rather than pasted into the prompt. `correct_workflow.json` and
  `InsureNation (Website Chatbot) - Leads.json` are earlier snapshots kept for diffing.
- These are **import/export artifacts of their builder**, not something this repo compiles or
  serves. Nothing reads them at build or run time. Change the workflow on their side, export,
  commit the new file — hand-editing the JSON changes nothing live.
- The client used to key off these nodes — the consent option `id` echoed as `reply_id`, the
  `crm_funnel_flag` values, the exact contact-turn wording `contactAsk.js` sniffs for. None of
  that is wired now. `isContactAsk` is the last trace and it is dormant.

The `wgt_…` widget token is gone from the tree with the transport that used it. It was a
**public** widget token, guarded by an origin allowlist rather than by secrecy, so finding it in
`git log` is not finding a leaked credential. The key that replaced it is not like that at all:
`RAG_API_KEY` is a real secret, it lives in the Go service's environment, and it must never
appear in a `VITE_*` variable — that would compile it into the public bundle.

### Mobile

Below 560px the panel is a full-screen sheet, set in `chat.css` — a 380px floating card on a
360px phone is not a card. The rules there use `!important` because the components carry their
sizing inline, which is this codebase's convention. Four of them are not cosmetic:

- **The height is set from JS** off `window.visualViewport` (`ChatPanel.jsx`), because
  `inset: 0` is the *layout* viewport and an on-screen keyboard does not shrink that — so the
  composer would sit underneath the keyboard exactly when it is being typed into. `100dvh`
  does not solve this; it tracks browser chrome, not keyboards.
- **The composer is 16px on mobile.** Below that, iOS Safari zooms the page on focus and the
  visitor cannot zoom back out.
- **The launcher is hidden while the panel is open** (`.imn-chat-launcher--open`). It is fixed
  to the same corner at the same z-index and painted after the panel, so it covers the send
  button.
- **The composer is not auto-focused on a touch screen.** Focusing it summons the keyboard over
  half the panel before the visitor has read the question.

## The backend

It serves the embedded site and answers a healthcheck. That is all it does.

- Only a placeholder `backend/internal/dist/index.html` is committed; the Docker build
  overlays the real Vite output. Do not commit a real built `index.html` there — it names
  hashed bundles that aren't committed.
- `CANONICAL_HOST` redirects page requests to one hostname (`canonicalHost` in `server.go`),
  which matters because only the custom domain's chat works. `/api/` and `/v1/` are exempt:
  `/api/health` is what `railway.toml` polls, and a stale cached bundle still calling `/v1/*`
  should get a JSON 404 rather than a redirect or the SPA shell. `server_test.go` pins both.
- `serveSPA` answers `/api/*` and `/v1/*` misses with JSON 404 rather than the SPA shell.
- `CLIENT_IP_HEADER` still feeds `middleware.RateLimiter`, and **must** name a header the edge
  *overwrites* (`X-Real-Ip` on Railway). Naming one the edge does not set is worse than leaving
  it blank: every caller can then claim any IP.
- `/v1/ask` is the chat proxy (`handler/ask.go`). It holds `RAG_API_KEY`, adds the bearer
  header, and relays the corpus RAG's status and body **unchanged** — answer shaping,
  citation selection and the premium guardrail are the RAG's, and a second copy here would
  be a second place for them to drift. It binds `{q, history, insurer, line, session_id,
  phone, name, email, data}` and silently drops anything else, so a new field on the request
  needs a struct field first.
- `/v1` carries its own `RateLimiter(15, 1m)` rather than the global one: each call spends an
  embedding and a completion, and the global allowance is sized for page requests. Two
  caveats the code does not shout about — `middleware.CORS()` aborts every `OPTIONS` at
  engine level with `Access-Control-Allow-Origin: *` **before** the `/v1` group runs, so
  preflights bypass both the allowlist and both limiters (harmless today: the site's own
  call is same-origin and issues no preflight); and the limiter's bucket maps never evict.
- The service reads seven env vars. `PORT` and `ENV` through `config.LoadConfig` (defaults
  `8080` / `production`); `CANONICAL_HOST` and `CLIENT_IP_HEADER` straight off `os.Getenv` in
  `server.go`; `RAG_URL` and `RAG_API_KEY` per request in `handler/ask.go`; and
  `RAG_ALLOWED_ORIGINS` once at boot in `middleware/alloworigins.go`. `config.Config` has a
  field for none of the last five — grep, don't assume the struct is the whole list.
- **The `RAG_*` variables are live again.** Older notes said to delete them from the Railway
  service, which was true while the browser called imagine.bo direct. Removing them now takes
  the chat down: without `RAG_URL` and `RAG_API_KEY` every turn answers 503, and without
  `RAG_ALLOWED_ORIGINS` the endpoint accepts any origin on the internet and pays for it.
  `RAG_KB_ID` really is dead — nothing reads it.

`frontend/kb-corpus.txt` and `scripts/export-kb.mjs` are kept, but **the website chat does
not read them.** Answers come from the corpus RAG, whose documents are the insurers' own.
The file is still how this site's copy reaches a knowledge base at all, and the dograh
workflow is a separate integration that may still ingest it — so re-run the script after copy
edits and ask whoever owns that side to re-ingest. Do not assume anything picks it up alone.

## Known content bug

`frontend/src/data/site.js` and `frontend/src/pages/Contact.jsx` state **different office
addresses** (Arunachal Building / Barakhamba Road vs Ambadeep Building / Kasturba Gandhi
Marg), so the live site shows both. The knowledge base uses the Contact page's, which has
two corroborating references. `site.js` still needs fixing.
