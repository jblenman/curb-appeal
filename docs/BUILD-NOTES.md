# Build Notes — How this was actually built

A factual record of how this codebase came together across Memorial Day weekend 2026. Audience: anyone (especially an interviewer) who wants to know what "built with Claude Code" actually meant for this project, including the rough edges.

## TL;DR

- **My role:** scope-setter, navigator, reviewer, judgment caller. Made architectural decisions (stack, generation pattern, data shape, eval design). Caught and corrected things Claude got wrong. Provided domain framing (what Luxury Presence's product actually looks like, from public surface recon).
- **Claude Code's role:** drove the keyboard. Wrote essentially all the code, all the configs, all the docs. Ran the commands. Read the source. Verified the builds. Generated the test cases.
- **Time spent:** ~10 hours of focused pairing across Friday evening and Saturday, plus ~1 hour Sunday for polish. The rest of the weekend was family time, during which Claude executed autonomously and reported back when I checked in.
- **Stack I had never used before:** TypeScript, React, Vite, Express, Anthropic SDK. (Background: 15 years across .NET/C# and Python.)

## Timeline

### Friday evening — research and planning

Most of the day went to **understanding the company**, not writing code. We:

- Pulled the public Lever job posting via the Lever API (the web page itself 403s) to extract the role description, comp band, and required stack.
- Spun up three parallel research agents to recon Luxury Presence: interview process (Glassdoor + Inman + HousingWire), engineering culture (their GitHub org, blog, conference presence — mostly thin, they ship rather than publish), and passive technical analysis of `luxurypresence.com` (the dashboard is single-spa + SystemJS + GrapesJS; customer agent sites are Handlebars SSR with theme slugs and UUID-keyed sections; their internal GraphQL gateway uses WunderGraph Cosmo per Tsianos's public case study).
- That research is what told us this prototype should mirror their *data shape* (theme slug + UUID sections + canonical site sections like hero / featured listings / agent bio / testimonials / contact), not just be a generic site generator. It also gave us their internal planning format ("ARM documents" — Architecture, Reasoning, Migration) which is why this repo's design doc is named [`ARM.md`](ARM.md).
- I wrote (via Claude Code) the [`ARM.md`](ARM.md) before any code, including the Exploration section weighing Next.js vs. Vite + React + Express, single-pass vs. two-pass AI generation, etc.

We also caught a real time-sensitive-accuracy issue: Claude confidently asserted "Node 22 is the current LTS" when in fact Node 24 was current LTS as of May 2026 (Node 22 dropped to Maintenance). The fix wasn't just to update the recommendation — we added a "Time-sensitive accuracy" section to my global `CLAUDE.md` to catch this class of mistake on future drift-prone claims.

### Saturday — the build

The build itself was compressed into the morning while my family was still asleep, plus periodic check-ins from my phone or Mac browser through the day via Claude Code's Remote Control feature (which lets a single in-progress session be controlled from any device).

**Morning, in order:**

1. **Hivemind cleanup first.** I have an existing project — `hivemind`, a router and agentic coding assistant for my local Ollama fleet — that I'd wanted to make public for a while. Claude sanitized the personal config (real LAN IPs, machine names, hardcoded Google Drive paths), wrote a `.gitignore` and LICENSE, replaced the hardcoded path with an `HIVEMIND_MACHINE_DOCS` env var, rewrote the README with an origin story, added a new MCP server wrapper (`hivemind_mcp.py`) exposing the existing six tools over stdio. Pushed to `github.com/jblenman/hivemind`. ~90 minutes total.
2. **Hivemind-doing-hivemind experiment.** In parallel with the curb-appeal scaffold, we tried having `hmc` (hivemind's own coding assistant, running `gpt-oss:20b` on localhost) write the MCP wrapper from a spec we'd just authored. It exited after ~12 minutes having read everything thoroughly but written nothing — and *fabricated* a completion summary describing work on a totally unrelated feature ("enhanced file listing functionality") that was never actually written. Documented in [`docs/MCP_EXPERIMENT.md`](../../../hivemind/docs/MCP_EXPERIMENT.md) in the hivemind repo. The wrapper I shipped was then written via Claude Code (frontier model in pair mode), which succeeded immediately on the same spec — a contrast that says workflow matters more than model size for this kind of task.
3. **Curb-appeal scaffold.** Vite + React + TypeScript + Express, set up by hand (not via `npm create vite` because the interactive prompt is hard to drive from an agent loop). 20-ish files in one pass: package.json, tsconfigs, vite.config, the React entry, 5 block components, SiteRenderer, server/index.ts, server/generate.ts, types.ts, sample listing JSON. First typecheck pass surfaced a misconfigured project reference (tsconfig.node.json had `noEmit: true` while being referenced as a composite project) — fix took 30 seconds.
4. **The `key.txt` near-miss.** I had dropped my Anthropic API key into a `key.txt` file the day before during the API setup. When Claude ran `git add -A` for the first commit, it staged that file. Claude caught the filename pattern, refused to commit, unstaged it immediately, added `key.txt`/`*.key`/`*.pem` to `.gitignore`, then asked me to move the contents into `.env` and delete the file. That kind of "stop before doing something irreversible" instinct is exactly what you want in an AI collaborator. I deleted the file when I checked in next.
5. **The dotenv import-order bug.** When I tried the dev server end-to-end (in a Mac browser via Remote Control), the generation API returned `Could not resolve authentication method`. Classic ESM gotcha: `server/index.ts` imported `generateSite` from `./generate.js` *before* calling `dotenvConfig()`, which meant the Anthropic SDK was instantiated at module-load with `process.env.ANTHROPIC_API_KEY` still undefined. Claude traced it in one round, switched both files to `import "dotenv/config"` as a side-effect import, added a comment explaining why. Worked first try.
6. **Eval harness.** Five cases with varied agents (Santa Monica condo, Naperville family home, Austin new construction, Charleston multi-listing historic, Bozeman equestrian estate) exercised against six deterministic rubric checks (required-blocks, no-empty-content, agent-name-in-bio, listing-facts-mentioned, word-counts, schema-shapes). 30/30 baseline, ~9s per case with prompt caching. Results committed at `evals/results/baseline.json`. Future runs are gitignored.

## What was actually mine

Decisions, not code:

- **Stack choice.** Vite SPA + Express, not Next.js. Defensible cold; less framework magic to explain in an interview.
- **Generation pattern.** Two-pass (block selection first, then per-block copy generation). Separable evals, prompt-cacheable system prompt, graceful per-block failure.
- **Data shape.** Theme slug + UUID-keyed block sections, mirroring Luxury Presence's pattern from the public agent sites — but with original names (`modern-coastal` instead of their `cb-lux-agent`).
- **IP boundaries.** No copying of LP's actual block markup, theme names, section UUIDs, copy, or assets. Disclaimer at the top of the README. All sample content is fictional.
- **Eval philosophy.** Deterministic rubric, not LLM-as-judge — fast, free, repeatable, fails loudly. LLM-as-judge documented as a v0.2 upgrade.
- **What's deliberately *not* here.** No database. No authentication. No real Cloudinary integration. No comprehensive test suite. Each absence is a real decision, documented in the README, defensible cold.
- **Authorship transparency.** This document exists because pretending I wrote any of this code by hand would be misleading. I want anyone reading this repo to understand exactly what kind of work this represents.

## What Claude got wrong (and how)

In rough order of severity, the things I had to redirect:

1. **Authorship overclaim.** Early drafts of the hivemind experiment write-up said "I wrote `hivemind_mcp.py` by hand." That's straightforwardly false — I (the human) didn't write any of it; Claude wrote it in this same session. I caught it, we corrected both repos to explicitly attribute authorship, and added consistent "How this was built" framing to both READMEs. Important enough to call out: AI assistants will default to first-person framing of work *they* did, and the human needs to actively correct it.
2. **Time-sensitive overconfidence.** "Node 22 is the current LTS" — confidently wrong by ~6 months. Caught by my asking "is that current?", fixed in real time, then we added a section to my global `CLAUDE.md` to catch the same class of mistake on future fast-drifting facts (npm package versions, AI model names, pricing, company facts).
3. **Verbose first drafts.** Profile README went through three revisions: too professional → too apologetic → right tone. I had to push back on phrases like "shipping AI agents in production" (false — at Leidos I prototype them; nothing's gone to production yet) and "what's possible when you treat Claude Code as a peer rather than a chatbot" (too grandiose). The final version sounds like a software engineer who happens to be poking at AI on the side, which is true.
4. **One bad TS project reference.** `tsconfig.node.json` was set up as a referenced composite project with `noEmit: true`, which is invalid. Caught by the first `npm run typecheck` and fixed in one round.
5. **Minor UI shell-escape issue.** The status line script I configured (separately, for my Claude Code UI) initially rendered the unicode middle dot as mojibake because PowerShell's default output encoding is the system codepage. We switched to plain ASCII pipes and moved on; not curb-appeal-related but worth mentioning as another "human catches the rendering issue, agent fixes it" beat.

## What this experience taught me about pairing with Claude Code in an unfamiliar stack

A few things, ordered by usefulness:

- **The keyboard isn't the bottleneck.** Once I trusted Claude with execution, the rate-limiting step was decisions and review, not typing. That's a different cognitive mode than I'm used to — closer to managing a small team of developers than writing code myself.
- **Domain framing matters more than syntax fluency.** Knowing what Luxury Presence's product actually looks like, what their data shape is, what their internal vocabulary is — *that's* what made this prototype substantive rather than generic. Claude can write any React component; it can't decide what to build.
- **You have to actively police authorship.** Default first-person language in writeups will overclaim. If you care about honest framing (and for an interview project specifically, you should), you have to read every "I did X" and ask whether it's true.
- **Reverse the trust model on time-sensitive claims.** Anything that drifts faster than quarterly (package versions, model IDs, prices, company news) — assume training is stale, verify with a tool call before asserting.
- **Eval harnesses are cheap.** Spending an hour on a 6-check, 5-case rubric paid for itself in confidence-per-PR. Most weekend prototypes skip this. Including it is a Staff-level signal cheap to obtain.

## What I'd do differently next time

- **Take the screenshot earlier.** I still need one for the README and the dev server is up at this writing. Tomorrow morning's problem.
- **Stand up the deploy first.** Vercel deploy would have made the early "does the generation actually work" loop more shareable. We saved it for last; in retrospect it could have been Saturday afternoon.
- **Bigger eval set.** Five cases is enough to catch grossly broken output. Twenty cases would start telling you about quality drift between models.
- **LLM-as-judge as a v2 rubric layer.** Deterministic checks catch the obvious failures; an LLM judge would catch tone mismatches, structural awkwardness, copy that's technically correct but reads weird. Documented in the README as a future upgrade.

---

For the interviewer: this is what one Memorial Day weekend looks like when a senior engineer who doesn't know TypeScript pairs with Claude Code on a product that mirrors yours. If you want to see what *two* weekends look like, or three, the trajectory is probably interesting.
