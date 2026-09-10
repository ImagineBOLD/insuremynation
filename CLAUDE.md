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

node scripts/check-contact-ask.mjs     # chat: the contact-ask detector, and the form's validation
node scripts/check-split-options.mjs   # chat: the reply-to-chips parser
node scripts/check-page-context.mjs    # chat: first-seen landed_from / referrer
node scripts/check-emphasis.mjs        # chat: unwrapping **bold**, keeping "T&C apply*"
node scripts/check-ask-response.mjs    # chat: answer-or-error (dormant — /v1/ask is gone)

go build ./... && go vet ./... && go test ./...
go test ./internal/server -run TestCanonicalHost -v    # one test
go run ./cmd/server      # serves the committed *placeholder* dist, not a real site build;
                         # the chat works with no env set — see The backend
```

From the repo root:

```bash
make deploy              # railway up --service insuremynation --ci
```

There is no lint or test framework in the frontend and it does not need one. The
`scripts/check-*.mjs` files are plain `node` + `assert` and cover the pieces of the chat
client that fail *silently* — a reworded consent sentence takes the contact form away and
nothing complains, a broken parser stops rendering chips or eats the text it mistook for a
menu, broken attribution reports nothing, and a broken emphasis unwrap leaks asterisks or
swallows a footnote marker. Run them after touching any of it, and run
`check-contact-ask.mjs` after any change to the workflow's contact turn — it is the only thing
that would tell you the form has gone unreachable. `check-ask-response.mjs` is dormant; see
*Which half is dormant now*. Everything else in the frontend is verified visually; the backend
has build, vet and test.

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

**The panel is ours; the assistant is not.** `useHeadlessChat.js` posts to a same-origin
`POST /v1/chat/init` and `POST /v1/chat/message`, and `backend/internal/handler/orchestrator.go`
relays both to imagine.bo's Dograh workflow — the same workflow answering WhatsApp. Everything
that decides what the visitor reads is on their side: the funnel, the persona, the guardrails,
the plan-catalogue lookups, the lead capture. The reply is relayed **verbatim**
(`c.Data(resp.StatusCode, …)`), deliberately, so that reshaping it here cannot become a second
place for those rules to drift.

**The relay holds no key, and exists for reachability rather than secrecy.** The widget token is
public by design — it used to ship in a script tag on the page — and what guards their endpoint
is an Origin allowlist naming the production host alone. A browser cannot forge `Origin` (it is a
forbidden header name); a server can set it. That asymmetry is the whole reason these two routes
exist instead of the panel calling them direct, and it is also why **the chat is testable from
localhost**: the browser never speaks to them.

This repo has now served three different answering stacks through `/v1`, and the history matters
because each swap was invisible in a frontend diff. The panel called their orchestrator from the
browser; then `/v1/ask` proxied our corpus RAG; then `/v1/ask` *was* the assistant, answering
from the plan catalogue with its own funnel and guardrails in `internal/assistant/`. That whole
package is deleted, along with `internal/crm` and `handler/ask.go`. The reason for coming back
here is that two implementations of one funnel, in two languages, in two repos, cannot be kept in
step by hand — and the website and WhatsApp answering the same question two ways is the failure
that keeps getting reported.

**There is one chat transport in this repo, and that is deliberate.** It has been violated once
already: `4208f42` carried this relay *alongside* the `/v1/ask` path that was deployed, so a
plain `make deploy` would have silently swapped the website's whole answering stack. `/v1/ask`
and `/v1/opener` are the ones gone now, and `readAnswer` in `askResponse.js` is the last trace of
them. If a second transport ever appears beside `/v1/chat/*`, that is the bug, not a migration
step. `HEADLESS_CHAT_INTEGRATION.md` is **not** history any more: it is the wire contract for the
`/widget-proxy/*` endpoints this relay calls, response shapes and error table included. Read it
before touching `orchestrator.go`.

What the workflow reaches, and this repo no longer does: the plan catalogue's **seven MCP tools**
— `insurance_catalog`, and a `*_plan_lookup` per line (health, life, motor, group,
fire_commercial, travel). Each lookup takes `q`, `insurer`, `plan_slug` and `limit`; `plan_slug`
accepts up to three comma-separated slugs and returns every full record in one call, which is how
a comparison is answered. 522 curated records across 19 insurers, holding no premiums and no
waiting-period durations by construction. One knowledge base, and now one assistant on top of it,
so the two channels cannot answer the same question two ways.

**The guardrails are not here, and there is no copy of them in this repo.** Earlier notes in this
file said the opposite — that `internal/assistant/guard.go` and `coverage.go` were the only copy
in the customer's path, ported from the RAG's `guard.py`/`answer.py`/`coverage.py`, and that no
case in `guard_test.go` should be relaxed without reading the test that pinned it. Those files
are deleted. What went with them: the ~600-character reply cap, premium-leak detection (including
phrasings carrying no premium word), waiting-period-duration detection including paraphrases,
refusal-by-name for insurers we do not place *before* any model call, and `Tidy`'s markdown and
menu normalisation.

What carries it now is the workflow's `globalNode` "Persona + Ground Truth" — the
no-premiums, no-waiting-periods, never-re-ask rules — enforced by prompting inside imagine.bo's
runtime, with **no test in any repo**. Three consequences worth holding on to:

- The only client-side guard left is `unwrapEmphasis.js`, and only for paired `**`/`__`.
  Re-adding the rest in the browser would be worse than the gap: a length cap truncates
  mid-sentence and cannot tell a leak from a long legitimate answer, and a leak detector in a
  Vite bundle publishes the very regexes it filters for.
- `Tidy` used to indent dashed lines in prose so `splitOptions.js` could not eat them. Nothing
  indents anything now. Server-declared `options[]` win over the heuristic, so the exposure is
  confined to prose replies that happen to carry a flush column-0 `- ` list, where the last
  contiguous run will be read as a menu and removed from the bubble.
- `scrapper`'s `tests/test_answer.py` is now the only executable copy of those cases anywhere in
  the workspace, and it sits in front of nobody. The workspace `CLAUDE.md` instruction to "fix a
  leak in one and fix it in both" no longer describes anything real and needs rewriting there,
  not patching.

**Opening a conversation is a server call, and the session is theirs.** `useHeadlessChat.js`
posts `/v1/chat/init` when the panel opens **on an empty transcript**, and again on `reset` —
never when a conversation is restored. `ChatWidget.openPanel` calls `chat.init()` on every open,
and `init` returns early when `messages.length`, so reopening the panel, or a refresh that
rehydrated the transcript from `sessionStorage`, posts nothing and keeps the bubbles already
there. `init` mints the session and returns the opening turn from the page context, so a visitor
standing on `/health-insurance`, or landing on `/?product=health` from an ad, gets that funnel's
first question rather than being asked which cover they want. The reply carries `session_token`,
`run_id`, `opening_message` and `options[]`; that `run_id` is logged to the console once per
session and is the only support handle their side accepts.

What is left, and what each piece is for:

| file | job |
| --- | --- |
| `useHeadlessChat.js` | the client: the session token, one turn at a time, reminting, errors |
| `askResponse.js` | **dormant** except `citationLabel` — see *Which half is dormant now* |
| `pageContext.js` | which page, and first-seen ad attribution — sent once, as `context_variables` |
| `splitOptions.js` | turns the column-0 `- ` lines of a reply into chips, when no `options[]` came |
| `unwrapEmphasis.js` | drops paired `**`/`__` so the bubble does not show asterisks |
| `contactAsk.js` / `ContactForm.jsx` / `countries.js` | the contact turn as fields instead of a paragraph — its detector is **live**, see below |
| `ChatPanel.jsx` / `Message.jsx` | the panel and bubbles, per the WhatsApp-style design; `Message`'s citation and plan-card paths are wired and never fed |
| `ChatWidget.jsx` | launcher, open/close, Escape |
| `RobotGlyph.jsx` | the handoff's `chatbot.svg` as inline JSX — launcher (white), header (brand blue) |

Seven things that are easy to get wrong:

- **The contact ask is decided by the assistant's prose, and that is a live dependency on
  wording we do not own.** `askContact` is `isContactAsk(last?.text)` — a regex over their
  generated consent sentence (`contactAsk.js`). When they reword it the form stops appearing,
  nothing breaks, nothing complains, and the visitor gets a bare keyboard where a form should
  be. That exact failure has happened: the detector stood in front of the corpus RAG, which
  never wrote the sentence, and this channel produced **zero** CRM leads for as long as the
  gate held. `node scripts/check-contact-ask.mjs` pins the live wording so a reword surfaces
  there instead, and it is the one check in this repo worth re-running after any workflow edit.
  Never while a turn is in flight, never on top of an error, and never twice — `contactDone` is
  persisted, because re-asking someone who declined, on every refresh, is how a widget gets
  closed for good.
  **The lead chain has left this repo, and the way the contact details travel is not obvious.**
  `ContactForm` still passes `{name, phone, email}` as its second `onSubmit` argument, but the
  hook uses that argument *only* to set `contactDone`: the request body is
  `{session_token, text, reply_id}` and nothing else. So the details reach the workflow as
  **prose inside the message text**, parsed by its S1b node, and its `Push Lead to CRM` webhook
  node is what creates the lead. The phone is still the trigger; it just arrives as a line in a
  sentence rather than a struct field. Every other form on the site is still
  `onClick={() => setSent(true)}` with no fetch.
  **A `200` from that webhook still proves nothing, and now nobody here can check.** The
  `matched: false` and `matched: true`-with-no-`lead_id` failures that `crm/client.go` used to
  treat as errors are unhandled by anyone in this workspace — the caller is a payload template
  in their builder. The site's deploy log is no longer a lead-capture diagnostic; the only
  places to confirm a lead landed are the CRM UI and the workflow's run log, keyed on the
  `run_id` the console logs.
- **An `answer` is an answer whatever the status code** — and this rule now applies to nothing.
  It described `readAnswer` in `askResponse.js` reading a `/v1/ask` body. The orchestrator hook
  declares its own error strings and branches on the status directly, so `readAnswer`,
  `errorText`, `EMPTY_ANSWER` and `GENERIC_ERROR` have no caller and
  `node scripts/check-ask-response.mjs` covers nothing the app runs. The rule is kept written
  down because it is the piece most likely to be re-derived wrongly by whoever wires the next
  transport, and there have now been three. Two strings in it stay load-bearing for the live
  path via `ChatPanel`: `ErrorNotice` matches `/too many/i` to suppress its "you can also call
  us" footer, and any message naming the number must use `PHONE` from `data/site.js` verbatim
  or the notice prints it twice.
- **The origin allowlist is ours, and it is now the outer of two in series.**
  `RAG_ALLOWED_ORIGINS` on the Go service refuses an unlisted browser origin with
  `403 {"error":"origin not allowed","origin":"…"}`, the origin echoed back, before the relay is
  reached at all — so `ORCHESTRATOR_ORIGIN` never gets a chance to help there. It guards an
  endpoint that spends a model call upstream per turn. Unset, it **fails open** with a startup
  warning, so check the deploy log says `/v1 restricted to N origin(s)`. `localhost:5173` needs
  no entry: `vite.config.js` proxies `/v1` to `:8080`, so the call is same-origin. And the chat
  really is testable locally, for a reason that has nothing to do with our allowlist — see the
  relay's `Origin`-spoofing above. Their allowlist has no localhost entry and never will.
- **`landed_from` and `referrer` are first-seen, not current** (`pageContext.js`). A visitor
  lands on `/health-insurance?utm_source=google`, browses to `/about`, then opens the chat —
  read live, the UTMs are already gone and the attribution is empty on exactly the journeys
  worth measuring. **It now travels once**, as `context_variables` on `/v1/chat/init`, because
  the session upstream holds it for the rest of the conversation; under `/v1/ask` it rode every
  turn because the service stored nothing between them. Every value must still be a string.
  `node scripts/check-page-context.mjs` covers the stamping.
- **Chips come from the server first, and `splitOptions` is the fallback.**
  `assistantMessage(text, serverOptions)` uses the reply's `options[]` when it has them, keeping
  each option's real `id` — and that id is load-bearing: on the WhatsApp permission turn it is
  what records the consent, because the title alone reads correctly to a human and writes
  nothing. Only when no `options[]` came does it fall back to `splitOptions.js`, which takes the
  last contiguous run of `- ` lines **at column 0**; indentation is the test that separates a
  menu from a nested fact, and `node scripts/check-split-options.mjs` pins the shape against a
  real turn from this workflow. Note that nothing indents dashes in prose any more — `Tidy` did
  that and it is deleted — so the fallback is the one path where a prose list can be mistaken
  for a menu.
  `ChatPanel` computes `serverDeclared = chips.some(c => c.id != null)` and suppresses its
  "Change policy type" / "Request callback" shortcuts whenever chips carry real ids. With
  `progress` permanently null, `funnel` is permanently `false`, so those shortcuts are eligible
  on every turn again — but bounded, because every declared-option turn suppresses them anyway,
  and the heuristic turns still have the existing count and `call back` guards.
- **Citations and plan cards are wired and never fed.** `assistantMessage` hardcodes
  `citations: []` and `plans: []` — the protocol has no field for either — and both
  `Citations` and `PlanCards` in `Message.jsx` return null on an empty list, so nothing renders
  and nothing breaks. `citationLabel` in `askResponse.js` is therefore imported and never
  called. Keep all of it: the reasoning in those comment blocks is what stops the next person
  re-adding anchors to the insurers' own PDFs. We are a broker, and every such link was an exit
  to a company the visitor could then buy from directly, placed under our own answer, on our own
  site — which is why `source_url` used to arrive and was deliberately not rendered.
- **`Message.jsx` renders text as a child, never `innerHTML`**, with `pre-wrap`: replies carry
  newlines and are explicitly not markdown, so nothing must run them through a renderer. The
  model writes `**Cover**` regardless of what the prompt forbids, so `unwrapEmphasis.js`
  strips **paired** `**`/`__` before rendering — paired only, because insurance copy ends with
  a footnote marker ("T&C apply\*") that has to survive. Do **not** reach for a markdown
  library instead: besides the dependency, it would render the `- ` lines as an HTML list and
  `splitOptions` would never see them again. The transform runs on assistant text only; the
  visitor's own words are echoed exactly as typed.

Two things came back with the orchestrator, and older notes in this file said they were gone:

- **The session is server-issued.** A `session_token` and a `run_id`, minted by `init` and held
  upstream, so the client sends one message rather than a transcript. It expires, and the hook
  handles that itself: on `session_expired` — or on `finished`, or a missing token — `remint()`
  starts a fresh session and resends the message once, dropping `reply_id` because the new
  session never offered that option. Two consequences: the conversation is *theirs*, so a
  restart on their side loses it in a way a stateless service could not, and there is no
  `HISTORY_TURNS` window to outrun, which is the whole class of bug the catalogue-era
  `line`/`asked` echo existed to work around.
- **There is a terminal state.** `finished` means the session is deleted upstream, and it **is**
  restored from `sessionStorage`. An older note here warned that restoring it "would remove the
  composer for good" — true when `finished` could never become true again, wrong under this
  protocol: `send` remints on `finished`, and `FinishedNotice` ships a working `reset`, so a
  returning tab recovers on the next message rather than dying.

And two things went away with the local assistant, so nothing here looks broken: `progress` and
`disclosure` are constant `null`, because the protocol has no field for either. The standing
disclosure bar and the progress bar simply do not render. The disclosure is not lost — the
workflow states it inside `opening_message`, which is where it came from before it was lifted
into a bar of its own.

### Which half is dormant now

The dormancy in the chat client has **swapped ends**, and whoever tidies up next will otherwise
delete the wrong half. Older notes in this file described the opposite arrangement; they were
right for the `/v1/ask` era and are wrong now.

`contactAsk.js` is **fully live**. `isContactAsk()` is the gate that decides when `ContactForm`
appears, matching the workflow's own consent sentence — see the first of the *easy to get wrong*
items above for why that is a real dependency on wording we do not own. `formatContact` and
`contactError` are imported by `ContactForm.jsx` as before. `formatContact` still takes `dial` as
its own field because it writes the visitor's own bubble, and that bubble is now the *only* way
the number reaches anyone: there are no structured fields on the request, so the E.164 folding
that used to happen for the CRM's benefit happens on the workflow's side from this prose.
All of `check-contact-ask.mjs` covers live code.

`askResponse.js` is **dormant**, except `citationLabel` and `prettyInsurer`, which `Message.jsx`
imports and — because `citations` is always empty — never calls. `readAnswer`, `errorText`,
`EMPTY_ANSWER` and `GENERIC_ERROR` have no caller under `src/`. `check-ask-response.mjs` is
dormant with the module: a green run there is not coverage of anything the running app does.

There is **no consent checkbox** on the form, and there should not be — the permission is asked
as its own turn, one turn later, exactly as the workflow asks it on WhatsApp. Putting it on the
form would be the same question twice. Note that the restored `orchestrator.go` originally
carried a `Consent *bool` request field whose comment claimed such a checkbox existed; it was
dropped on the way back in, because a field nothing can populate carrying a comment that argues
for a change we have rejected is worse than no field.

**The contact close is the workflow's, in its S1b and S1c nodes.** It used to be two canned turns
in `internal/assistant/consent.go` — `WhatsAppAsk`, then `ReadConsent` and `ContactAck`, neither
calling a model, because a permission is not something a model may phrase for itself: what goes
in the record has to be the exact words the visitor was shown. That reasoning still holds, and it
is now enforced on their side. `WhatsAppQuestion` was the string stored as `consent_text`; the
equivalent is their `whatsapp_consent_text` context variable, and changing it changes what the
record claims the visitor was asked.

**The consent record is the lawful basis for messaging the lead, and the CRM's send gate reads
it** — which is why the destination of their consent webhook matters and is currently wrong. See
the workspace notes on the repoint; in short, a row in CallMind's platform consent log is
*evidence*, not authorization, because it is keyed by phone alone across every tenant, whereas
the send gate reads the org-scoped record. A refusal must be recorded as `denied`, never as an
omission: "no record" and "they said no" are different facts.

### The funnel

**Same questions, and the owner has moved again — away from here, for the third time.** The site
once ran the funnel in the browser through the orchestrator; then the corpus RAG ran it
server-side; then `backend/internal/assistant/funnel.go` did. Now the workflow's own F1–F6 nodes
run it, which is where those questions, their order and their option lists were lifted verbatim
from in the first place. Every previous owner was a copy of this one.

Everything the earlier owners needed is therefore gone, and a reader of older code should know it
went rather than broke: `Remaining()` and `funnelGuidance()` (which handed outstanding questions
to the model as context rather than gating on them), the 28-character prefix match, `ActiveLine`
and `FoldAsked`, the `line`/`asked` echo, `OfferedOptions`, `Tidy`'s selective indentation, and
`HISTORY_TURNS`. The bug that whole apparatus existed to fix — a transcript window outrunning the
state derived from it, so the funnel restarted at the router mid-qualification and let the contact
form in — **cannot occur here**, because no window is sent. The session upstream holds the
conversation and the client sends one message.

`reason`, `step` and `steps` are gone with it. The contact form's veto used to key on
`reason === 'funnel'`; there is no `reason`, so the gate is `isContactAsk` over the assistant's
prose, and mid-qualification restraint is the workflow's problem now. `progress` is constant
`null`, so `FunnelProgress` never renders — including the count that could drop mid-conversation
("1 of 6" then "2 of 4", because a new car skips two of the six questions).

**This repo's client renders whichever funnel is running and authors no part of it.** That
sentence has been in this file through three owners and is finally true without qualification:
there is no local `GREETING` fallback path in play, no funnel data in the bundle, and every
question, option list and stage decision arrives in the reply. Which is the point — it cannot
drift from the voice channel's copy, because there is no copy.

**The root JSONs are promoted, then: they are the live specification of the thing answering every
turn**, not a historical record of what a previous funnel was copied from. Read `globalNode`
before assuming the assistant "should" answer something; most of what it declines, it declines on
purpose, and that block is now the only place those rules are written down for the website too.
Note the boundary in the scrapper repo has not changed and is easy to misread: only its `dograh/`
tooling reads `globalNode`, `dograh/` imports nothing from `corpus/`, but `corpus/` **does**
import `dograh/` in the legacy `/api/chat/init` and `/api/chat/message` handlers
(`corpus/service/app.py`), so they are not two isolated packages. The RAG never read the export
at runtime — `FUNNELS` in its `service/flow.py` is literal data — and that is doubly moot now
that it answers nothing. The reason the exports stay in *this* repo is that their `dograh/`
tooling reaches across the filesystem for one of them (`dograh/workflow_source.py`: `SITE_REPO /
"correct_workflow.json"`, overridable with `INSUREMYNATION_REPO`), and the workflow they describe
is live.

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
- **The three are three different stages, not three vintages.** "Newest wins" is the wrong mental
  model — each carries different MCP wiring, and the newest is the *least* runnable:
  - `correct_workflow.json` — the clean pre-MCP baseline. All 14 `tool_uuids` are `[]`. This is the
    one the scrapper's `dograh/` tooling actually reads, via `INSUREMYNATION_REPO`
    (`workflow_source.py`), so it is `patch_workflow.py`'s input and `preflight.py`'s diff baseline.
    Do not "update" it to a patched copy.
  - `InsureNation-workflow-mcp.json` (commit `adc96e0`) — `patch_workflow.py` output, 9 nodes armed
    with the literal placeholder `["<UUID:kb_mcp>"]`. `apply_uuids` was never run on it, so **as it
    stands it cannot make a tool call**.
  - `InsureNation (Website Chatbot) - Leads.json` — the only one holding a *resolved* uuid
    (`5e31f7fa-…`) on 10 nodes. Its armed set is off-contract, though: it includes nodes 13
    (`S1b · Contact & Consent`) and 23 (`S1c · WhatsApp Permission`), which the scrapper's
    `preflight.py` requires to carry **no** tools, and omits node 8 (`F5 · Travel`).
  None of the three carries `mcp_tool_filters`, so every armed node in them reaches all seven
  catalog functions. The MCP server URL and bearer key are in none of them — those live in the
  Dograh UI, referenced only by tool uuid.
- **The two `webhook` nodes are the lead path, and both are currently pointed at the wrong
  place.** `Push Lead to CRM` posts to `/api/v1/webhooks/disposition`, which exists but
  correlates a post-call outcome to an *already-stored* contact by phone — it is not the lead
  creator, so a first-time website visitor has nothing for it to match. `Push WhatsApp Consent`
  posts to `/api/v1/messaging/consents`, which the CRM does not serve at all: that path is
  CallMind's platform log, keyed by phone alone across every tenant, and a row there is evidence
  rather than authorization. Both need repointing at `/api/v1/webhooks/lead-status` — which
  creates leads and accepts consent as its own top-level block — with the **per-org** credential
  rather than the platform one. All three exports agree on the wrong values, so this is not one
  stale file.
- These are **import/export artifacts of their builder**, not something this repo compiles or
  serves. Nothing reads them at build or run time. Change the workflow on their side, export,
  commit the new file — hand-editing the JSON changes nothing live. That cuts both ways now: the
  workflow is what answers the website, so a fix there needs no deploy here and nothing in this
  repo will show that it happened.
- The client keys off these nodes again — the option `id` echoed as `reply_id`, and the exact
  contact-turn wording `isContactAsk` matches. The `crm_funnel_flag` values are the exception:
  they feed the workflow's own webhook payload, not anything here.

The `wgt_…` widget token is back in the tree, as `orchestrator.go`'s default for
`ORCHESTRATOR_WIDGET_TOKEN`. It is a **public** widget token — it used to ship in a script tag on
the page — guarded by an origin allowlist rather than by secrecy, so finding it in the source or
in `git log` is not finding a leaked credential. It is a default rather than a required variable
deliberately: a missing variable that silently disables the chat is a failure this service has
already had.

**The Go service now holds no secret at all.** `KB_API_KEY`, `OPENAI_API_KEY` and `CRM_API_KEY`
went with `internal/assistant` and `internal/crm`. The rule they were subject to still stands for
anything added later: nothing secret may ever appear in a `VITE_*` variable, because this is a
Vite build and that compiles it into the public bundle.

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
