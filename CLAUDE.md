# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Layout

Two directories, **one** deployable.

| path | what |
| --- | --- |
| `frontend/` | the React site (Vite + React 18 + React Router 6 + Framer Motion) |
| `backend/` | Go service: serves the built site from an embedded filesystem, plus a `/v1` chat relay nothing calls any more |

Plus, at the root, three JSON files and `HEADLESS_CHAT_INTEGRATION.md` that are part of
**neither** build: exports of, and an integration guide for, the imagine.bo/Dograh orchestrator
chat. Since the hosted widget replaced it (see *The chat*) they are a record, not a spec.

**Stale docs:** `README.md`, `HEADLESS_CHAT_INTEGRATION.md` and the comment in
`frontend/vite.config.js` still describe the old in-house panel / orchestrator chat (including
`check-*.mjs` scripts that no longer exist). This file is the current source of truth.

This file is the **only** `CLAUDE.md` in the repo, and `README.md`, `.gitignore` and
`.gitattributes` are likewise single and at the root. Do not re-add per-directory copies.
`frontend/` used to carry its own `CLAUDE.md` and `README.md`; both were removed and that
removal is pushed, so a pull will not bring them back. If upstream ever re-adds one, fold
its content in here and delete it again rather than keeping two.

The `Dockerfile` and `railway.toml` are at the **repo root**, not in `backend/`, because
the build needs both directories: it builds the site with npm, embeds the output into the
Go binary via `//go:embed` (`backend/internal/fs.go`), and ships one container. On Railway
leave the service's Root Directory empty so the build context is the repo root.

Deployed at **https://insuremynation.imaginebo.app** — the canonical host; point ads there. The
Railway subdomain (`insuremynation-production.up.railway.app`) serves the same build, and
`CANONICAL_HOST` redirects its page requests to the custom domain (`canonicalHost` in
`server.go`). Whether the hosted widget works on a given host is decided by the widget
provider's own domain settings, not by anything in this repo. `RAG_ALLOWED_ORIGINS` only guards
the dormant `/v1` relay.

Everything here is on GitHub, `backend/` and the deploy files included. Upstream authors
the site itself, so when pulling expect it to own `frontend/src/pages`,
`frontend/src/data`, `frontend/src/styles` and `frontend/public`. The local edits
to upstream's files are, in `frontend/index.html`, the chat widget `<script>` (see *The chat*)
and the **deleted reCAPTCHA v3 loader** — a WordPress leftover for a Contact Form 7 form this build does not have, whose only
effect was Google's floating badge in the bottom-right corner, behind the chat panel. Nothing
reads `grecaptcha`. A pull that restores it brings the badge back; delete it again.

`frontend/index.html` is otherwise upstream's, and its head is now mostly marketing tags:
**three** GTM containers (`GTM-PNX2KL6`, `GTM-5CMDJ73Z`, `GTM-N2D4SQ9W`), a Google Ads
`gtag` (`AW-16945755026`) and a Meta Pixel (`452243449957607`), each GTM with a
`<noscript>` twin in the body. Three containers on one page is more likely a duplicate than
a plan — ask whoever runs the ad accounts before adding a fourth or removing one, and expect
pulls to touch this block. **Those tags are consent-gated:** each is marked
`type="text/plain" data-consent` (the gtag loader carries its URL in `data-src`) and stays inert
until the visitor clicks "Accept all" in `src/components/CookieBanner.jsx`. The `window.imnConsent`
script after the Meta Pixel then runs them, and on later visits it runs them straight away
(choice in `localStorage['imn-cookie-consent']`, `all` or `essential`). The Privacy Policy promises
exactly this, so a pull that brings a tag back as a plain `<script>` breaks that promise: re-mark it.
The `<noscript>` twins in the body are not gated; a visitor without JS cannot see the banner.
Everything below them (the font preconnect/preload, the
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

go build ./... && go vet ./... && go test ./...
go test ./internal/server -run TestCanonicalHost -v    # one test
go run ./cmd/server      # serves the committed *placeholder* dist, not a real site build;
                         # the chat works with no env set — see The backend
```

From the repo root:

```bash
make deploy              # railway up --service insuremynation --ci
```

There is no lint or test framework in the frontend and it does not need one; it is verified
visually. The backend has build, vet and test.

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
  therefore scoped by a root class on each page: `.p-landing`, `.p-about`, `.p-sub`, `.p-legal`
  (the Privacy Policy, which is not from the handoff), plus `.p-sub[data-product="health"]` and
  `.p-sub[data-page="contact"]`. When adding a `data-r` name, check `global.css` for collisions
  with other pages. Shared components rendered on several page types have their rules
  scoped with `:is(...)`, e.g. the `Testimonials` rail (home + About) and `TalkToExperts`.
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
- The 22 `partner-<insurer>.webp` logos are not from the handoff either: the client supplied
  them as PNGs exported at 4× their drawn size, with a Figma frame ("Frame 45") for the
  section, and they went through `npm run images:optimize -- partner-` (two tiny flat ones
  came out smaller as lossless WebP and were encoded by hand). Their drawn sizes live in
  `PARTNERS` in `src/data/site.js`, in frame order; the wall's 9 / 8 / 5 rows come from
  wrapping that order at 1600px, so reordering or adding a logo moves the row breaks.
  `npm run images` would bring back the handoff's old `partner-1…10`, which nothing uses.

## The chat

**The chat is a third-party widget**, one `<script>` tag in `frontend/index.html`:

```html
<script src="https://app-production-f3da.up.railway.app/widget/v1/loader.js" data-key="pk_1suYFuWwUhGE656s" async></script>
```

It lives in `index.html`, outside the React tree, on purpose: the site is an SPA, so route
changes and back/forward never reload the page and the widget keeps its state across pages.
Do not move it into a component. `data-key` is a public widget key, not a secret.

The in-house chat panel (`frontend/src/components/chat/`, its `scripts/check-*.mjs`, and the
`<ChatWidget/>` mount in `App.jsx`) was removed when this widget replaced it; see git history.
The backend's `/v1/chat/*` relay to the Dograh orchestrator is still in `backend/` but nothing
on the site calls it any more. The root workflow JSONs describe that old orchestrator chat.

## The backend

It serves the embedded site, answers a healthcheck, and still exposes the two `/v1` relay calls
the old in-house panel made (nothing on the site calls them now; the notes below describe them
for whoever removes or revives them). It holds no credential.

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
- `/v1/chat/init` and `/v1/chat/message` are the whole chat (`handler/orchestrator.go`). `init`
  binds `{data}` and posts `{widget_token, context_variables}` to `/widget-proxy/init`; `message`
  binds `{session_token, text, reply_id}` and **rebuilds** the body rather than relaying what it
  received, so a field the panel does not know about cannot reach their API through us. Both cap
  the request at 32KB and the reply at 1MB. `reply_id` is always sent, `null` included: their API
  distinguishes "the visitor typed this" from "the visitor tapped that option", and on the
  permission turn that distinction is what records a consent.
- **The reply is relayed verbatim, and that makes failures diagnosable by whose error body you
  get.** `c.Data(resp.StatusCode, …)` passes their status and body straight through, so a `403`
  is *their* allowlist refusing us — check `ORCHESTRATOR_ORIGIN`. Only a transport failure
  synthesises a body here, and it is always a `502 {"error":"could not reach the assistant"}` or
  `…"could not read the assistant's reply"`. Those three branches log; nothing else does, because
  a non-2xx from them is their diagnosis to give, not ours to interpret.
- **The relay sets `Origin` and `Referer` to `ORCHESTRATOR_ORIGIN`, and that is the point of it
  existing.** Their allowlist matches `Origin` and names the production host alone. A browser
  cannot forge that header; a server can set it. So the call is made from here with the
  production origin attached regardless of who reached this service — it describes the deployment
  this relay speaks for, not the caller. `Content-Type`, `Origin` and `Referer` and nothing else:
  their CORS preflight permits no more, and matching the in-browser request exactly is what keeps
  this indistinguishable from the one they already allow.
- `/v1` carries its own `RateLimiter(15, 1m)` rather than the global one (which is 120/min): a
  turn is a model call on their side and possibly an MCP tool call on top, and the global
  allowance is sized for page requests. Two caveats the code does not shout about —
  `middleware.CORS()` aborts every `OPTIONS` at engine level with
  `Access-Control-Allow-Origin: *` **before** the `/v1` group runs, so preflights bypass both the
  allowlist and both limiters (harmless today: the site's own call is same-origin and issues no
  preflight); and the limiter's bucket maps never evict.
- The service reads eight env vars, and `config.Config` has a field for two of them — grep,
  don't assume the struct is the whole list. It used to read thirteen, while this table claimed
  eleven and listed twelve, which is why the instruction is worth keeping.

  | var | read in | what happens without it |
  | --- | --- | --- |
  | `PORT`, `ENV` | `config.LoadConfig` | defaults `8080` / `production` |
  | `CANONICAL_HOST`, `CLIENT_IP_HEADER` | `server.go` | no redirect; the limiter keys on the socket IP |
  | `RAG_ALLOWED_ORIGINS` | `middleware/alloworigins.go`, once at boot | **fails open** with a startup warning |
  | `ORCHESTRATOR_URL` | `handler/orchestrator.go` | defaults to `https://orchestrator.imagine.bo` |
  | `ORCHESTRATOR_WIDGET_TOKEN` | same | defaults to the live public token |
  | `ORCHESTRATOR_ORIGIN` | same | defaults to `https://insuremynation.imaginebo.app` |

- **All three `ORCHESTRATOR_*` default to the live values, so the chat works with no environment
  at all** — including from a bare `go run`. That is deliberate: none of the three is a secret,
  and a missing variable that silently disables the chat is a failure this service has already
  had. Override per environment when one of them moves.
- **`RAG_URL`, `RAG_API_KEY` and `RAG_KB_ID` are dead, and so are `KB_API_URL`, `KB_API_KEY`,
  `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `ASSISTANT_MODEL`, `CRM_BASE_URL`, `CRM_API_KEY` and
  `CRM_LEAD_TYPES`.** Nothing reads any of them. Delete them from the Railway service **after**
  the relay is confirmed working in production, not before: a rollback needs the second group,
  and an env-less rollback gives every visitor a 503 they can see. `RAG_ALLOWED_ORIGINS` keeps
  its now-thoroughly-misleading name on purpose — renaming it means a deploy window where the old
  name is gone and the new one is not yet set, which leaves `/v1` open to any origin on the
  internet. It is one variable and a rename buys nothing.
- **The deploy log is no longer a lead-capture diagnostic.** `crm: reported session … as lead …`
  will never appear again, and its absence proves nothing: the lead push is the workflow's
  webhook node. Confirm a lead in the CRM UI or the workflow's run log, keyed on the `run_id` the
  browser console logs once per session.

`frontend/kb-corpus.txt` and `scripts/export-kb.mjs` are kept, but **nothing in this repo reads
them, and no file in this repo can reach the chat any more.** What the assistant knows is
configured on the widget provider's side. After a site copy change, re-run the script and hand
the corpus to whoever owns the widget's knowledge base; nothing picks it up alone.
