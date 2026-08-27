# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Layout

Two directories, **one** deployable.

| path | what |
| --- | --- |
| `frontend/` | the React site (Vite + React 18 + React Router 6 + Framer Motion) |
| `backend/` | Go service: serves the built site from an embedded filesystem, and nothing else |

This file is the **only** `CLAUDE.md` in the repo, and `README.md`, `.gitignore` and
`.gitattributes` are likewise single and at the root. Do not re-add per-directory copies.
`frontend/` used to carry its own `CLAUDE.md` and `README.md`; both were removed and that
removal is pushed, so a pull will not bring them back. If upstream ever re-adds one, fold
its content in here and delete it again rather than keeping two.

The `Dockerfile` and `railway.toml` are at the **repo root**, not in `backend/`, because
the build needs both directories: it builds the site with npm, embeds the output into the
Go binary via `//go:embed` (`backend/internal/fs.go`), and ships one container. On Railway
leave the service's Root Directory empty so the build context is the repo root.

Deployed at **https://insuremynation.imaginebo.app** — that is the canonical host and the
only one the chat works on, because imagine.bo's orchestrator enforces a domain allowlist and
only this domain is on it. The Railway subdomain
(`insuremynation-production.up.railway.app`) still answers and serves the same build, but its
chat gets a `403 Domain not allowed`, which presents as a page that looks fine above a dead
assistant. `CANONICAL_HOST` makes the service redirect page requests there; see
`canonicalHost` in `server.go`. Point ads and anything else public at the custom domain, and
when adding a new origin — a staging host, a dev port — get it allowlisted first or its chat
will 403 too.

Everything here is on GitHub, `backend/` and the deploy files included. Upstream authors
the site itself, so when pulling expect it to own `frontend/src/pages`,
`frontend/src/data`, `frontend/src/styles` and `frontend/public`. The chat is ours and
lives in `frontend/src/components/chat/`. The only local edits outside that directory are the
`<ChatWidget/>` mount in `App.jsx` and, in `frontend/index.html`, the **deleted reCAPTCHA v3
loader** — a WordPress leftover for a Contact Form 7 form this build does not have, whose only
effect was Google's floating badge in the bottom-right corner, behind the chat panel. Nothing
reads `grecaptcha`. A pull that restores it brings the badge back; delete it again.

## Commands

All `npm` commands run from `frontend/`; all `go` commands from `backend/`.

```bash
npm run dev              # Vite dev server on http://localhost:5173
npm run build            # production build into frontend/dist/
npm run preview          # serve the production build
npm run images           # regenerate public/assets/ from the design handoff bundle
node scripts/export-kb.mjs   # regenerate kb-corpus.txt from the site's own copy

node scripts/check-split-options.mjs   # chat: the reply-to-chips parser
node scripts/check-page-context.mjs    # chat: first-seen landed_from / referrer
node scripts/check-contact-ask.mjs     # chat: spotting the contact turn
node scripts/check-emphasis.mjs        # chat: unwrapping **bold**, keeping "T&C apply*"

go build ./... && go vet ./... && go test ./...
```

There is no lint or test framework in the frontend and it does not need one. The
`scripts/check-*.mjs` files are plain `node` + `assert` and cover the pieces of the
chat client that fail *silently* — a broken parser stops rendering chips (or worse, eats the
text it mistook for a menu), broken attribution reports nothing, a reworded contact turn
loses the form, and a broken emphasis unwrap leaks asterisks or swallows a footnote marker.
Run them after touching any of it. Everything else in the
frontend is verified visually; the backend has build, vet and test.

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

**The UI is ours; everything behind it is imagine.bo's.** `useHeadlessChat.js` calls
`orchestrator.imagine.bo` **direct from the browser** against the contract in
`HEADLESS_CHAT_INTEGRATION.md`. They own the funnel questions, the system prompt and the
lead capture — their assistant asks for the visitor's contact details itself and writes the
lead to their CRM.

We used to run our own proxy for this: a Go service at `/v1/*` holding a RAG API key, with the
funnel in `journeys.js` and prompts in `chat.go`. All of it is deleted, because the headless
integration has **no key to hide** — so there was nothing left for a backend of ours to do.
`git log` has it if the reasoning is ever needed; do not resurrect it to add a feature the
orchestrator should own.

What is left, and what each piece is for:

| file | job |
| --- | --- |
| `useHeadlessChat.js` | the three-endpoint client: sessions, turns, errors, terminal state |
| `pageContext.js` | the `context_variables` that decide where the funnel opens, and the attribution |
| `splitOptions.js` | turns the column-0 `- ` lines of a reply into chips |
| `unwrapEmphasis.js` | drops paired `**`/`__` so the bubble does not show asterisks |
| `contactAsk.js` / `ContactForm.jsx` / `countries.js` | the contact turn as fields instead of a paragraph |
| `ChatPanel.jsx` / `Message.jsx` | the panel, per the WhatsApp-style design |
| `ChatWidget.jsx` | launcher, open/close, Escape |

Six things that are easy to get wrong:

- **It only works on an allowlisted origin.** Not a setting of ours — imagine.bo keeps the
  list, and everything else gets `403 Domain not allowed`. `localhost:5173` is **not** on it
  today, so the chat cannot be exercised locally; you get the "chat is unavailable" state.
  Ask them before relying on any new host.
- **`landed_from` and `referrer` are first-seen, not current** (`pageContext.js`). A visitor
  lands on `/health-insurance?utm_source=google`, browses to `/about`, then opens the chat —
  read live, the UTMs are already gone and the attribution is empty on exactly the journeys
  worth measuring. `node scripts/check-page-context.mjs` covers it.
- **Chips are parsed out of the reply** (`splitOptions.js`), from the last contiguous run of
  `- ` lines **at column 0**. Indentation is the test that separates a menu from a nested
  fact: the bot writes plan comparisons as a `Cover:` line with indented dashes under it, and
  while the parser accepted those, every fact became a chip *and* was cut from the body — the
  visitor got a bare label. The integration guide's own version of that parser walks up from the final line
  and stops at the first non-option — which finds nothing, because the live opener ends with
  a line of prose *after* the list. `node scripts/check-split-options.mjs` pins the real
  shape. But when a response carries a populated `options` array, **those win and the
  heuristic is skipped**: they are server-declared choices, and the tapped option's `id`
  goes back as `reply_id` — on a consent option (the WhatsApp ask) that id is the only
  thing that writes the consent row; the title alone reads fine and records nothing. Typed
  answers send `reply_id: null`, and so does the `session_expired` resend.
- **The contact turn is spotted by its wording** (`contactAsk.js`), because nothing in the
  response says "I am asking for details now". Their prompt is theirs to reword, so this fails
  soft to the composer and `check-contact-ask.mjs` holds the current text. Ask them for a
  marker on the response and this whole file goes away.
- **A finished conversation removes the composer** rather than disabling it. The session is
  deleted their side, so sending into it opens a *second* conversation — and since a
  conversation ends in a lead, that is a duplicate in the CRM.
- **`Message.jsx` renders text as a child, never `innerHTML`**, with `pre-wrap`: replies carry
  newlines and are explicitly not markdown, so nothing must run them through a renderer. The
  model writes `**Cover**` regardless of what the prompt forbids, so `unwrapEmphasis.js`
  strips **paired** `**`/`__` before rendering — paired only, because insurance copy ends with
  a footnote marker ("T&C apply\*") that has to survive. Do **not** reach for a markdown
  library instead: besides the dependency, it would render the `- ` lines as an HTML list and
  `splitOptions` would never see them again. The transform runs on assistant text only; the
  visitor's own words are echoed exactly as typed.

**Never add a *second* ask for contact details.** Their assistant collects name, mobile and
email itself, two turns in, and that lead is theirs. What the panel does have is a form that
answers *their* question — `ContactForm.jsx`, shown when `isContactAsk()` matches the reply,
because that one turn carries no `- ` options and so leaves the visitor typing three kinds of
data into one box on a phone. It captures nothing: submitting sends an ordinary chat message
(`name\n+91 number\nemail`) and the CRM record is still written on their side. Under the
fields sits a consent checkbox, ticked by default, mirroring the consent sentence in their
bubble; unticking it does not block the send — it appends an explicit refusal line to the
message instead. The composer
stays visible underneath, which is both their rule and the fallback when the detector misses —
`node scripts/check-contact-ask.mjs` pins the live wording so a reword fails a check instead of
silently removing the form.

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
- The `RAG_*` variables are dead — nothing reads them. Remove them from the Railway service.

`frontend/kb-corpus.txt` and `scripts/export-kb.mjs` are kept: the corpus is still how the
site's own copy reaches a knowledge base, but ingesting it is imagine.bo's side of the line
now, so re-run the script after copy edits and ask them to re-ingest.

## Known content bug

`frontend/src/data/site.js` and `frontend/src/pages/Contact.jsx` state **different office
addresses** (Arunachal Building / Barakhamba Road vs Ambadeep Building / Kasturba Gandhi
Marg), so the live site shows both. The knowledge base uses the Contact page's, which has
two corroborating references. `site.js` still needs fixing.
