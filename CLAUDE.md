# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Layout

Two directories, **one** deployable.

| path | what |
| --- | --- |
| `frontend/` | the React site (Vite + React 18 + React Router 6 + Framer Motion) |
| `backend/` | Go service: serves the built site from an embedded filesystem, plus the `/v1` chat relay |

Plus, at the root, three JSON files that are part of **neither** build: they are exports of
the imagine.bo/dograh chat workflow — which is now the thing that answers the chat, so they are
the live specification rather than a record. See *The funnel* below; their filenames mislead.

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
one whose chat works. There are now **two** allowlists in series and ours is the outer one:
`RAG_ALLOWED_ORIGINS` on this service lists this domain alone, and behind it imagine.bo enforces
its own on the same host. The Railway subdomain
(`insuremynation-production.up.railway.app`) still answers and serves the same build, but its
chat gets `403 {"error":"origin not allowed"}` from us before the relay is even reached — a page
that looks fine above a dead assistant. `CANONICAL_HOST` makes the service redirect page requests
to the custom domain; see `canonicalHost` in `server.go`. Point ads there. Adding an origin is a
Railway variable, but it is still a step: an unlisted host gets a 403 the same way. A dev port is
the exception — Vite proxies `/v1`, so `localhost:5173` is same-origin and needs no entry, and
their allowlist never sees it because the relay attaches the production origin server-side.

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

It serves the embedded site, answers a healthcheck, and relays the two `/v1` calls the chat
makes. That is all it does, and it holds no credential doing it.

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
them, and no file in this repo can reach the chat any more.** Plan facts come from the catalogue,
and everything the assistant may say about the *firm* — the office, the leadership, what each
product covers, the claims desk, careers — is the workflow's `globalNode` block. So the matching
edit after a site copy change is one nobody in this workspace can make: re-run the script, then
ask whoever owns the workflow to update the persona and re-ingest. Do not assume anything picks
it up alone.

## Known content bug

`frontend/src/data/site.js` and `frontend/src/pages/Contact.jsx` state **different office
addresses** (Arunachal Building / Barakhamba Road vs Ambadeep Building / Kasturba Gandhi
Marg), so the live site shows both. The knowledge base uses the Contact page's, which has
two corroborating references. `site.js` still needs fixing.
