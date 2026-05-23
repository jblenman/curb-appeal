# ARM: curb-appeal

**Author:** Jeffrey Blenman
**Status:** Draft — pre-build (2026-05-22)
**Context:** Self-driven weekend prototype as interview preparation for Luxury Presence Staff SWE — AI Website Builder role.

> An ARM document is Luxury Presence's internal planning format ("Architecture, Reasoning, Migration" — verified by their public hiring materials referencing "ARM documents" with explicit exploration phases). Using their format on purpose: it signals familiarity with how they think before writing code.

---

## 1. Context

Luxury Presence's AI Website Builder team ships micro-frontend `@luxurypresence/website-builder-scene` inside their single-spa dashboard. Customer-facing output is Handlebars-templated SSR with a theme slug per site (`cb-lux-agent` was visible on `julielongteam.com`), section blocks identified by UUID, and Cloudinary-served media. Canonical site shape observed on multiple LP-built agent sites: Hero → Featured/Sold Properties → Home Search → Neighborhoods → Team/Bios → Testimonials → Home Valuation → Blog → Contact.

This project builds a stripped-down version of that flow — listing data + agent profile in, AI-composed one-page real-estate site out — to demonstrate (a) ability to pick up TypeScript/React/Node in a constrained timeframe with Claude Code as the development partner, and (b) familiarity with their domain and architectural patterns.

## 2. Goals

| ID | Goal | Acceptance signal |
|----|------|--------------------|
| G1 | Working end-to-end: input JSON → AI generation → rendered page | `npm run dev` produces a viewable site from a sample listing |
| G2 | Vite + React + TypeScript + Express stack, defensible cold | Every file in the repo is walkable in the gauntlet |
| G3 | Block-based composition mirroring LP's data shape (theme slug + UUID sections) | JSON site config is the contract; blocks compose from it |
| G4 | AI generation produces both block selection AND in-block copy from listing/agent data | Sample generations show plausible, on-brand prose |
| G5 | Decision journal + prompt log captured in repo as first-class outputs | `logs/` directory contains JSONL of every generation |
| G6 | Eval harness with rubric over 5 sample listings | `npm run eval` produces pass/fail per case + summary |
| G7 | README + this ARM + disclaimer (IP-safe framing) | Public repo presentable to LP interviewers without legal risk |

## 3. Non-goals

- Production-grade auth, payments, or multi-tenancy
- Database persistence (filesystem JSON is fine, easier to explain)
- Real Cloudinary integration (placeholder/Picsum URLs, room for note in README)
- Reproducing LP's actual block markup, CSS, theme names, or section UUIDs
- Deployment in v1 (room for v2 Vercel deploy if time permits)
- Comprehensive test suite (eval harness exercises the AI path; one or two unit tests on pure functions only)
- Beating the SOTA model — a good prompt with Sonnet 4.6 is enough

## 4. Exploration

### 4.1 Frontend framework

| Option | Pro | Con | Verdict |
|--------|-----|-----|---------|
| Next.js (App Router) | Closer to "fullstack out of the box," easy Vercel deploy | Lots of routing/server-component magic to defend in interview; opinionated where we don't need opinions | Reject |
| **Vite + React + TS (SPA) + separate Express** | Stripped down; every file has a clear job; closer to LP's MFE reality (their builder dashboard is a single-spa SPA, not Next.js) | More manual setup for static-site serving; no SSR | **Pick** |
| Astro | SSR + islands; matches LP's customer-site SSR pattern philosophically | Unfamiliar for me; harder to defend; weekend timebox doesn't permit learning curve | Reject |
| Plain HTML + Handlebars | Closest to LP's actual output | Doesn't demonstrate React/TS chops, which is the explicit gap to bridge | Reject |

Vite + React + TS wins because the interview-stage claim being made is "I can pick up TypeScript and React quickly." That requires a build that visibly uses both. Next.js obscures both behind framework conventions.

### 4.2 Backend shape

| Option | Pro | Con | Verdict |
|--------|-----|-----|---------|
| **Express server proxying Claude API** | Keeps API key server-side; idiomatic Node; easy to explain | One extra process to run | **Pick** |
| Direct browser → Anthropic API | Simpler topology | Exposes API key; not how anyone would ship this | Reject |
| Cloudflare Workers / Lambda | Production-shaped | Adds infra learning curve to weekend | Reject; revisit in v2 |
| Vite middleware | Single dev server | Awkward for prod build; muddies separation of concerns | Reject |

### 4.3 AI architecture

Two-stage generation, separated for traceability:

1. **Block-selection pass** — Claude receives the listing data + the available block catalogue + style guidance, returns an ordered list of block IDs to compose into the site.
2. **Copy-generation pass(es)** — for each selected block, Claude receives the block schema + the listing data and returns the structured fields (headline, subheadline, body, CTA text).

Why two passes:
- Separable evals (did we pick the right blocks? did we write good copy?)
- Independent prompt-cache hits — the block catalogue is static, big, cacheable
- Falls back gracefully (if copy fails for one block, the others still render)

Alternative considered: single mega-prompt returning full site config. Rejected — harder to debug, harder to eval, single failure kills the whole generation.

### 4.4 Data shape

```ts
// Theme slug + UUID-keyed sections — mirroring LP's pattern, distinct names
interface SiteConfig {
  themeSlug: string;          // e.g. "modern-coastal" (NOT "cb-lux-agent")
  agent: AgentProfile;
  blocks: SiteBlock[];        // ordered, each with its own UUID
}

interface SiteBlock {
  id: string;                 // uuid v4 per section (our pattern, not LP's IDs)
  type: BlockType;            // "hero" | "featured-listings" | "agent-bio" | ...
  content: Record<string, unknown>;  // block-type-specific
}
```

Five block types to start (matches the minimum viable cut of LP's canonical shape):

| Type | Purpose | Required fields |
|------|---------|-----------------|
| `hero` | Above-fold tagline + agent photo | headline, subheadline, ctaText, imageUrl |
| `featured-listings` | Up to 3 highlighted listings | items[] (price, address, beds, baths, sqft, imageUrl) |
| `agent-bio` | Short biography + credentials | headline, bodyMarkdown, headshotUrl, yearsExperience |
| `testimonials` | 2-3 client quotes | items[] (quote, attribution) |
| `contact` | Capture-form CTA | headline, ctaText, fields[] |

### 4.5 Decision journal / prompt log

Every generation writes to `logs/generations/<timestamp>-<input-id>.jsonl` with one record per Claude call (prompt, response, tokens, latency, model). This is interview gold: lets us narrate decisions and show exactly what Claude Code helped produce.

### 4.6 Eval harness

`evals/cases/*.json` — 5 sample inputs (varied: condo, luxury single-family, multi-listing agent, new-construction, suburban).
`evals/rubric.ts` — programmatic checks:
- Required block types present (heuristic by type)
- Copy mentions facts from input (price, beds, neighborhood — string search)
- No obvious hallucinations (no proper nouns appearing in output that weren't in input, allowing for stylistic neighborhood adjectives)
- Word counts within sane bounds per block

`npm run eval` runs all cases, prints pass/fail matrix, and writes a results JSON. Not LLM-as-judge — deterministic and fast on purpose. (Mention LLM-as-judge as a v2 upgrade in the README; signals awareness of the technique without committing to a slow eval.)

## 5. Decisions (summary)

| | Pick | Why |
|---|------|-----|
| Frontend | Vite + React 18 + TypeScript | Demonstrates the stack gap being bridged |
| Backend | Express (Node 20+) | Idiomatic, defensible |
| AI provider | Claude Sonnet 4.6 via Anthropic SDK | Their stack; prompt caching available |
| Styling | Tailwind | Minimal CSS surface, easy to defend |
| State / data fetching | TanStack Query (React Query) | One small library; avoids hand-rolled fetch state |
| Build tool | Vite (default config) | Fast dev loop |
| Package manager | npm | Default; no extra learning |
| Testing | Vitest (unit), eval harness (integration) | Vite-native, minimal config |
| Logging | JSONL files in `logs/` | Plain files; trivial to inspect |

## 6. Architecture sketch

```
┌────────────────────┐     ┌──────────────────────────┐
│  Vite + React SPA  │────▶│  Express API (Node)      │
│  /                 │     │  POST /api/generate      │
│  /preview/:id      │     │   - block-selection pass │
│  /editor (stretch) │     │   - copy-gen pass        │
└──────┬─────────────┘     │   - writes logs/         │
       │                   └──────────┬───────────────┘
       │                              │
       │ reads site config             │ calls Anthropic
       ▼                              ▼
┌────────────────────┐     ┌──────────────────────────┐
│  data/sites/*.json │     │  Anthropic Claude API    │
│  (filesystem store)│     │  (Sonnet 4.6 + caching)  │
└────────────────────┘     └──────────────────────────┘
```

## 7. IP / legal posture

A weekend project mimicking a competitor's product is a real risk surface if handled carelessly. Rules we follow:

- **Disclaimer in README** (top of file): "A personal weekend project exploring what Luxury Presence's AI Website Builder team builds. Not affiliated with or endorsed by Luxury Presence — just a senior engineer's homework before an interview. Built with Claude Code."
- **No copy of LP-owned assets**: don't reuse their theme slug names, section UUIDs, block markup, CSS, Cloudinary tenant, or any proprietary copy from their public site.
- **Generic placeholder content**: all sample listings, agents, photos, and neighborhoods are fictional. Use Picsum or generic stock for images.
- **Stack mirroring is fine; product mirroring is bounded**: industry-common patterns (theme slug + UUID blocks, MFE dashboards, AI block generation) are not anyone's IP. Their specific implementation is.
- **License**: MIT. Permissive but our disclaimer keeps the framing personal/educational.

## 8. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Vite/React learning curve eats Sat afternoon | If shaky by Sat night, fall back to a CLI-only generator that writes static HTML — still demonstrates AI generation; loses TS/React signal | 
| Claude API key delayed | Local mock mode: pre-recorded JSON responses for the 5 eval cases; lets the UI work end-to-end without live calls |
| Generation quality is bad | Tighten system prompt, add few-shot examples in the block catalogue prompt; lean on prompt caching to iterate cheaply |
| Eval rubric too strict | Start permissive; tighten if all-green looks meaningless |
| IP concern raised in interview | Disclaimer + this section + verbal acknowledgment that this is mimicry-for-learning, not competition |
| Spending Sunday on polish at expense of substance | Hard timebox: Sunday afternoon for polish, no more |

## 9. Open questions (decide during build)

- Live preview pane vs static render-on-generate? (Lean static for v1)
- Editing affordances on top of generation? (Stretch; skip for v1)
- One-click "regenerate this block" UX? (Strong demo signal — try if time)
- Vercel deploy in v2? (Probably yes; takes ~30 min once Express is wired)

## 10. Definition of done (v0.1)

- [ ] Repo public at `github.com/jblenman/curb-appeal`
- [ ] README with disclaimer, run instructions, screenshots, architecture overview
- [ ] `npm install && npm run dev` from a fresh clone produces a working app
- [ ] One end-to-end generation visibly works on screen
- [ ] `npm run eval` passes on the 5 sample cases
- [ ] This ARM doc + a session-narrative `BUILD-NOTES.md` capturing how Claude Code drove the work
- [ ] Tagged v0.1
