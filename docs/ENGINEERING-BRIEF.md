# curb-appeal — Enhancement Project

> **Project status:** Active — see [Phase status](#phase-status) for current state of each phase.
> **Project started:** 2026-05-27
> **Last updated:** 2026-05-29

---

## Project at a glance

**curb-appeal** is an AI-driven real-estate website generator (Vite + React + TypeScript + Express, deployed to Vercel). The initial prototype (v0.1.0, May 2026) demonstrated the canonical real-estate-agent site shape and generated section content via the Claude API, scored by a structural eval harness.

This project enhances the prototype along five disciplines — **security**, **AI engineering visibility**, **accessibility**, **discoverability**, and **performance** — informed by a survey of ten production websites in the AI-real-estate-platform hosting space. The survey was an opportunity scan: where can an applied-AI generator add the most value? Each discipline ships as a single phase (PR or labeled commit cluster) with a clear thesis, scope, and success criteria. The headline phase (Phase 2) adds a visible AI engineering loop that elevates the demo from a static-feeling page to a live engineering artifact a reviewer can watch operate.

If you are reading this for the first time, jump to [Phase status](#phase-status) for current state, then to [Phases](#phases) for the work itself. The survey that informed the plan is summarized in [Opportunity landscape](#opportunity-landscape), with per-observation detail in [Appendix A](#appendix-a--survey-observations-in-detail).

---

## Phase status

| # | Phase | Status | Shipped | PR / Commit |
|---|---|---|---|---|
| 1 | Security & hardening | Planned | — | — |
| 2 | AI engineering & demo telemetry | Planned | — | — |
| 3 | Accessibility (WCAG 2.1 AA) | Planned | — | — |
| 4 | Discoverability & SEO | Planned | — | — |
| 5 | Performance | Planned | — | — |

**Status values:** `Planned` → `In progress` → `Shipped` → `Superseded` (if a later plan replaces this work) or `Skipped` (with a documented reason).

If this table has not been updated in many months, treat the planning sections that follow as historical context and check the repository commit history and PR labels for actual current state. Git history is the source of truth for what has shipped; this document is the plan.

---

## Phases

Each phase ships as a single PR (or labeled commit cluster) with a thesis statement in the description, a short "what this addresses" note linking to the relevant survey observations, and a checklist of changes. Atomic commits within a phase are fine, but they ladder up to the thesis. The intent is for the GitHub history to read as five deliberate engineering passes, not as a series of small fixes.

### Phase 1 — Security & hardening

> *"Standard defensive headers, configured once at the platform level."*

**Scope**
- Configure HSTS (`max-age=31536000; includeSubDomains; preload`)
- Set `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`
- Add minimal `Permissions-Policy`
- Author a Content-Security-Policy appropriate to the SSR + external-script footprint
- Remove platform-disclosing response headers
- Apply subresource integrity to any CDN-loaded JavaScript
- Configure via Vercel response-headers config (single source of truth)

**Why first**
Independent of other phases, minimal code surface, fast to ship. Builds momentum. The output (`securityheaders.com` grade A) is a visible demo trophy that can be surfaced in the telemetry overlay added in Phase 2.

**Informed by** — [Observation 7](#observation-7--security-headers-are-unset)

**Success criteria**
- `securityheaders.com` grade A or A+
- No platform-disclosure headers in production response
- CSP enforced (not report-only) in production

**Estimated effort at planning time:** 1–2 days

---

### Phase 2 — AI engineering & demo telemetry

> *"Convert this from a static-feeling demo into a live AI engineering loop you can watch run."*

**Scope**
- **Persona input UI:** text box on the demo page, with three example prompts (e.g. "luxury agent in Aspen specializing in mountain ski properties," "family-focused team in Plano serving Collin County," "boutique broker in Soho focused on prewar buildings")
- **Streamed generation:** each section streams in as it is produced via Server-Sent Events; user sees the page assemble live
- **Multi-model routing:**
  - Haiku for SEO metadata generation and JSON-LD emission
  - Sonnet for hero copy, about section, testimonial generation
  - Opus (or Sonnet with a higher reasoning budget) for uniqueness scoring and eval critique
- **Eval-driven refinement loops:** generate → score against rubric → critique → regenerate sections below threshold; cap at two refinement rounds per section
- **Cross-tenant uniqueness scoring:** on demand, generate a second persona's site and surface a similarity score (embedding cosine) per section
- **Telemetry overlay** (always-on, dismissable):
  - Tokens in / out per section, per model
  - Latency per section
  - Eval scores per section, before and after refinement
  - Prompt cache hit rate
  - Per-generation cost in dollars
  - Model routing decisions per section

**Abuse / cost controls**
- Per-IP rate limit (3 generations / hour)
- Per-prompt cache (identical persona returns the cached site)
- Daily spend cap on the Vercel function, with a kill-switch when the cap is reached
- Generation queue with a reasonable concurrency limit

**Why second — and why this is the headline**
This phase establishes the multi-model routing infrastructure that subsequent phases (especially Phase 3's AI alt-text generation and Phase 4's structured-data emission) consume. It is also the change that flips the demo from static-feeling to alive — the single most important enhancement for the prototype's purpose as a portfolio piece.

**Why it matters** — The prototype as initially shipped generated the same output every visit; AI activity was invisible to a casual visitor. This is the phase that fixes that.

**Success criteria**
- A reviewer can hit the live demo, enter a persona, and watch a site assemble in under 30 seconds
- Same persona produces visibly different sites on regeneration (variance is observable)
- Telemetry numbers match actual API spend within a small tolerance
- Eval scores improve through the refinement loop on at least 80% of generation runs

**Estimated effort at planning time:** 1–2 weeks

---

### Phase 3 — Accessibility (WCAG 2.1 AA)

> *"Accessibility is both the right default and an SEO multiplier — this phase brings the generator to WCAG 2.1 AA across the canonical site shape."*

**Scope**
- Add `<html lang="en">` to the page template
- **AI-generated alt text** using vision-capable model + property/agent metadata:
  - Property images: `{price} {beds}-bedroom {style} at {address}, {view-angle}`
  - Agent photos: alt derives from agent name and role
  - Decorative images: explicit `alt=""`
  - Generated alt is surfaced in the telemetry overlay so reviewers can see the loop working
- Color-contrast validation in the eval rubric: text-on-image overlays must meet 4.5:1; generator adjusts overlay shade or backdrop opacity if the rubric flags it
- ARIA labels on interactive components (forms, sliders, modals)
- Skip-to-main-content link
- Automated axe-core scan in the eval harness; any AA violation fails the rubric

**Why third**
The AI alt-text generation consumes the multi-model routing built in Phase 2. The `lang` and skip-link items are trivial and shippable independently, but bundling them under the accessibility thesis is cleaner than spreading them across multiple phases.

**Informed by** — [Observation 2](#observation-2--document-language-attribute-is-unset), [3](#observation-3--alt-text-completion-varies-widely), [4](#observation-4--heading-hierarchy-varies)

**Success criteria**
- Lighthouse Accessibility score ≥ 95 on the generated demo site
- axe-core scan returns zero AA violations on every site generated through the eval harness
- "Accessibility score" tracked as a first-class metric in the eval overlay

**Estimated effort at planning time:** 3–5 days

---

### Phase 4 — Discoverability & SEO

> *"Generated sites need to actually rank. This phase adds the structured-data emission, semantic markup, and meta-quality controls that determine whether a generated agent site shows up for the queries it should."*

**Scope**
- **JSON-LD emission per section type:**
  - Hero / Identity block → `RealEstateAgent` schema (name, image, areaServed, telephone, sameAs)
  - Neighborhoods section → `Place` schema, one entry per neighborhood with descriptive content
  - Properties section → `Product` or `Property` schema, one per listing, with price / beds / baths / address
  - Testimonials section → `Review` schema
- Heading hierarchy enforcement at the template level: exactly one H1, generated from agent name + locale; semantic H2/H3 within sections
- **Meta tag quality:**
  - `<title>`: location + identity, ≤ 60 chars
  - Meta description: locally-flavored, 150–160 chars
  - OG title / description / image with type and dimension validation
  - Twitter cards (`summary` or `summary_large_image`)
- Per-site `sitemap.xml` generation with proper `lastmod`
- `robots.txt` with sensible defaults (allow major crawlers, disallow internal paths)

**Why fourth**
Consumes the section-aware content-generation pipeline from Phase 2. The structured-data emission is the most visible win — pasting a generated site URL into Google's Rich Results Test should return valid schema for multiple types.

**Informed by** — [Observation 1](#observation-1--structured-data-is-rarely-present), [4](#observation-4--heading-hierarchy-varies), [6](#observation-6--open-graph-image-handling-varies), [8](#observation-8--mild-cross-tenant-phrasing-overlap)

**Success criteria**
- Eval rubric includes a "Structured data score" (10/10 = all expected schema types present and valid)
- Google Rich Results Test passes on every generated demo site
- Lighthouse SEO score ≥ 95 on the generated demo

**Estimated effort at planning time:** 3–5 days

---

### Phase 5 — Performance

> *"Property cards are the content visitors come for. They belong in the initial HTML, not after hydration."*

**Scope**
- **SSR property cards:** replace any client-rendered template pattern with server-rendered output; progressive enhancement for filtering and sorting
- `decoding="async"` on all images
- **Per-origin resource hints** (preconnect, dns-prefetch) generated based on detected dependencies (CDN, fonts, tracking, IDX endpoint)
- **LCP optimization:** preload hero image with `fetchpriority="high"`, inline critical CSS for above-the-fold
- `font-display: swap` for web fonts
- Self-host fonts where licensing permits, avoiding the Google Fonts third-party hop

**Why last**
Largest refactor surface. Touches the rendering layer, the data pipeline, and the asset pipeline. Postponing it to the end means earlier phases do not have to navigate around a churning rendering layer.

**Informed by** — [Observation 5](#observation-5--property-listings-are-client-rendered), [9](#observation-9--lower-priority-observations)

**Success criteria**
- Lighthouse Performance score ≥ 90 on simulated mobile (4G)
- LCP < 2.5s
- TBT < 200ms
- Property cards visible in initial HTML when JS is disabled

**Estimated effort at planning time:** 1 week

---

## Sequencing & dependencies

```
Phase 1: Security & hardening              (1–2 days)
   ↓
Phase 2: AI engineering loop                (1–2 weeks)  ← headline
   ↓
Phase 3: Accessibility                      (3–5 days)
   ↓
Phase 4: SEO & structured data              (3–5 days)
   ↓
Phase 5: Performance                        (1 week)
```

**Total estimated effort at planning time:** 4–6 weeks part-time, 2–3 weeks focused.

**Critical path:** Phases 1 and 2 form the order-of-operations critical path. The AI infrastructure built in Phase 2 is consumed by Phases 3 (alt-text generation) and 4 (structured-data emission), so those phases gain leverage by waiting. Phase 5 sits last because it touches the largest code surface; doing it earlier would force later phases to navigate around an in-flight rendering-layer refactor.

---

## Project-level success criteria

| Metric | Target |
|---|---|
| Lighthouse Performance (mobile) | ≥ 90 |
| Lighthouse Accessibility | ≥ 95 |
| Lighthouse SEO | ≥ 95 |
| Lighthouse Best Practices | ≥ 90 |
| securityheaders.com grade | A |
| axe-core AA violations | 0 |
| Google Rich Results Test | Passes for ≥ 3 schema types |
| Eval rubric overall score | ≥ 8.5 / 10 |
| Demo: AI activity visible to a casual visitor | Yes |

Pre-project baselines (unenhanced prototype, surveyed sample) are captured separately. Achievement against targets is recorded in the Phase status table and in the eval-harness output per build.

---

## Opportunity landscape

The five-phase structure is informed by a survey of ten production websites in the AI-real-estate-platform hosting space, conducted 2026-05-26. The survey was an opportunity scan, not a critique: it maps where an applied-AI generator can add the most value across discoverability, accessibility, performance, and security — areas where automated generation can do, by default, work that's otherwise left to manual authoring.

Where the opportunities concentrate (numbers from the surveyed sample):

- Structured data (JSON-LD) present on only **1 of 10** sites — a wide-open SEO differentiation opportunity
- `<html lang>` not yet set on any of the **10** — a one-line WCAG 2.1 Level A win
- Empty `alt=""` rates spanning **0% to 94%** — a strong case for AI-generated alt text
- Heading hierarchy varies on **4 of 10** — room for template-level consistency
- Property listings client-rendered (Handlebars in `<script>` blocks) on **every** site — an SEO + performance upside via SSR
- Open Graph image handling varies on **3 of 10** — automatable at generation time
- Defensive HTTP headers (HSTS, X-Frame-Options, X-Content-Type-Options, CSP) unset across the sample — a quick complete-policy win
- Mild cross-tenant phrasing overlap ("unparalleled" on 5 of 10, "above and beyond" on 4 of 10) — a chance to instrument lexical diversity

Each opportunity maps to one or more phases above. Full methodology and per-observation detail in [Appendix A](#appendix-a--survey-observations-in-detail).

---

## Out of scope

Items deliberately excluded from this project, with rationale:

- **IDX / MLS integration.** Out of scope — would require licensed feed access and shifts the project from "demonstrable AI generator" to "real estate SaaS." The current prototype uses mocked listings; that remains appropriate.
- **Authentication, dashboards, admin UIs.** Out of scope — the deliverable is the generator and the live demo, not an end-user product.
- **Multi-tenant infrastructure.** Out of scope — the demo can generate one site per persona on demand without tenant isolation.
- **Email / lead capture.** Out of scope — would require backend services beyond the demo's purpose.
- **Custom domains / per-site deployment.** Out of scope — the demo runs on a single Vercel deployment; generated sites are previewed within the demo, not deployed independently.

---

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Public demo accumulates excessive Anthropic API spend | Medium | Medium | Per-IP rate limit, per-prompt cache, daily spend cap with kill-switch |
| Multi-model routing complexity slows Phase 2 | Medium | Low | Ship with a single-model fallback; routing is an enhancement, not a blocker |
| Eval refinement loop produces marginal-quality output | Medium | Low | Cap refinement rounds at two; keep the unrefined first pass as the baseline |
| SSR property card refactor (Phase 5) breaks existing layout | Low | Medium | Snapshot tests on existing demo before refactor; staged rollout |
| WCAG AA validation flags non-text content quality | Low | Low | Track as an eval-rubric note rather than blocking the refactor |
| Survey observations change before plan ships (sample sites evolve) | Low | Low | Treat the survey as a snapshot; the engineering improvements stand on their own merits regardless of where any other site lands |

---

## Appendix A — Survey observations in detail

### Methodology

To ground the plan in real-world evidence rather than assumption, ten production websites in the AI-real-estate-platform hosting space were surveyed on 2026-05-26. All were verified-platform-hosted via response-header signature. Each site's homepage HTML was fetched with a Chrome User-Agent and reviewed across five dimensions:

| Dimension | What was reviewed |
|---|---|
| SEO & structured data | `<title>`, meta description, JSON-LD blocks, OpenGraph/Twitter tags, sitemap.xml, robots.txt, heading hierarchy |
| Accessibility | `<html lang>`, alt-text completion, ARIA usage, heading structure |
| Performance signals | Resource hints, lazy loading adoption, third-party script count, CDN architecture, hydration patterns |
| Security | Response headers (HSTS, XFO, XCTO, CSP, Referrer-Policy), platform-disclosure headers |
| Content quality | Cross-tenant phrase overlap, generic-vs-locally-flavored copy patterns, OG image handling |

**What was not reviewed:** client-side rendered content (no headless browser execution), real-user performance metrics (Google PageSpeed Insights now requires an authenticated API key and was returning empty results during the survey window), authenticated platform admin surfaces, or any internal codepath. The survey operates entirely on public, unauthenticated HTTP responses.

Observations are presented as patterns across the surveyed sample — they map the opportunity space for an AI generator, not a critique of any specific site or operator. Several of these are content-authoring choices that any platform leaves to its users; the point is simply that a generator can handle them automatically.

### Observation 1 — Structured data is rarely present

Only **1 of 10 sites surveyed** emits JSON-LD schema markup; the one that does uses a neat pattern (a `RealEstateAgent` block plus a client-side script that injects `Place` schema by URL path), which confirms the platform supports it. For a vertical that lives on local SEO, that leaves a wide-open opportunity: a generator that emits `RealEstateAgent`, `Place`, `LocalBusiness`, `Property`, and `Review` schema by default earns richer SERP presentations and stronger local ranking signal out of the box.

### Observation 2 — Document-language attribute is unset

None of the 10 surveyed sites set a language on the `<html>` element, which WCAG 2.1 Success Criterion 3.1.1 calls for at Level A (screen readers and crawlers use it to pronounce and scope content). Because it's consistent across the sample it looks template-level — so a generator that sets it by default picks up a free accessibility win.

### Observation 3 — Alt-text completion varies widely

Empty `alt=""` attribute rates across the sample:

| Site rank by emptiness | % images with empty alt |
|---|---|
| Highest | **94%** |
| 2nd | 65% |
| 3rd | 46% |
| Median | 25–30% |
| Lowest | 0% |

The 0%-to-94% spread suggests alt text is largely left to manual authoring — exactly the kind of thing an AI generator can fill automatically from listing and agent metadata. The payoff is dual: accessibility (WCAG 1.1.1 Level A) and image SEO. Property images with descriptive alt text rank in Google Images for queries like "{neighborhood} mid-century modern 4 bedroom" — a real inbound channel for agents.

### Observation 4 — Heading hierarchy varies

Heading-structure patterns observed across the sample:

- 1 site with no H1 element on its homepage
- 2 sites with multiple H1s (including an H1 used for a contact-form header)
- 1 site whose H1 is a category phrase rather than an identity statement

Headings feed both screen readers and search engines, so enforcing exactly one identity-bearing H1 at the template level — generated from agent name + locale — is an easy, visible improvement a generator can guarantee.

### Observation 5 — Property listings are client-rendered

Across all ten sites, property cards render client-side via Handlebars templates packaged inside `<script type="text/x-handlebars-template">` blocks, hydrated from a JSON payload after page load. The static SSR shell loads fast, but the highest-SEO-value content — the listings themselves — is JavaScript-dependent. Server-rendering them is a clear opportunity:

- search renderers index JS-rendered content later and less reliably than server-rendered HTML
- social-share scrapers (Twitter/Facebook/LinkedIn) see only the OG meta, not listing data
- Largest Contentful Paint improves when above-the-fold content is in the initial HTML
- the page stays useful even if the listing-hydration path doesn't run

### Observation 6 — Open Graph image handling varies

On 3 of 10 sites the Open Graph image could be handled more robustly:

- one used an Unsplash stock image (a search-query result) as its social-share preview
- one shipped an empty `og:image` value
- one pointed `og:image` at a video file URL, where social platforms expect a static image

OG-image validation (MIME type, dimensions) plus a generated fallback are exactly the kind of small content-quality check a generator can enforce at build time.

### Observation 7 — Security headers are unset

Across the sample, the common defensive headers aren't set: no `strict-transport-security` (HSTS), `x-frame-options`, `x-content-type-options`, or `referrer-policy` (one site had a partial CSP). Most also send `x-powered-by`, which is conventionally dropped. None of this is a critical vulnerability — and that's the point: a complete header policy, configured once, is a fast and demonstrable win, the kind of detail a polished generator gets right by default.

### Observation 8 — Mild cross-tenant phrasing overlap

A handful of marketing phrases recur across tenants:

| Phrase | Sites containing |
|---|---|
| "unparalleled" | 5 of 10 |
| "above and beyond" | 4 of 10 |
| "world-class" | 2 of 10 |
| "boutique service" | 2 of 10 |
| "personalized service" | 2 of 10 |

Not verbatim duplication, but enough overlap to suggest copy converging on similar language — and across a corpus of many platform-hosted sites that adds up. AI generation should, if anything, produce *more* lexical diversity than manual authoring, which makes uniqueness a measurable property worth instrumenting (and a nice demo: generate two personas and show the similarity score).

### Observation 9 — Lower-priority observations

- Lazy loading is adopted across ~85–95% of images on most sites (good)
- `decoding="async"` is universally absent (minor performance opportunity)
- Resource hints are minimal and identical across all sites (1 preload, 0 prefetch, 0 dns-prefetch, 2 preconnect) — looks like a platform default rather than per-tenant tuning
- Cache headers are reasonable (`max-age=600, stale-while-revalidate=1200, public`)
- HTML entities (`&amp;`, `&#x27;`) appear unescaped in some meta descriptions — a small content-pipeline polish opportunity

---

## Appendix B — Eval rubric extensions implied by this project

Each enhancement phase adds metrics to the eval rubric so that future regressions are caught automatically. The combined rubric after all five phases should include:

1. **Structural correctness** — section types present, ordering, required fields populated (existing)
2. **Copy quality** — readability, locale specificity, brand voice consistency (existing)
3. **Structured data score** — schema types present and valid (Phase 4)
4. **Accessibility score** — axe-core AA violations count, Lighthouse Accessibility (Phase 3)
5. **SEO score** — Lighthouse SEO, meta tag quality (Phase 4)
6. **Performance score** — Lighthouse Performance, LCP, TBT (Phase 5)
7. **Security score** — `securityheaders.com` grade (Phase 1)
8. **Uniqueness score** — embedding-based cross-tenant similarity (Phase 2)
9. **Cost efficiency** — tokens per generated section, cache hit rate (Phase 2)
10. **Refinement efficacy** — score improvement through refinement rounds (Phase 2)

A regression in any metric causes the eval to fail, surfacing the failure in the demo's telemetry overlay and in CI.

---

*End of brief.*
