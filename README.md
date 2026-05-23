# curb-appeal

> *A personal weekend project exploring what Luxury Presence's AI Website Builder team builds. Not affiliated with or endorsed by Luxury Presence — just a senior engineer's homework before an interview. Built with Claude Code.*

An AI-driven real estate site generator. Feed it a listing and an agent profile; it composes a one-page site from a block library with AI-written copy.

The interesting parts are the architecture, not the styling. See [`docs/ARM.md`](docs/ARM.md) for the design doc (formatted as an "ARM" document — Architecture, Reasoning, Migration — to mirror Luxury Presence's internal planning format).

## Run it

```bash
# 1. Install deps
npm install

# 2. Add your Anthropic API key
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=sk-ant-...

# 3. Start the app + API in parallel
npm run dev
```

The UI runs at `http://localhost:5173`. The Express API runs at `http://localhost:8787`.

## Stack

- **Frontend:** Vite + React 18 + TypeScript
- **Backend:** Express (Node 20+) — proxies Claude API so the key stays server-side
- **AI:** Claude Sonnet 4.6 via the Anthropic SDK with system-prompt caching
- **Generation pattern:** two-pass — block selection, then per-block copy (parallel)
- **Storage:** filesystem JSON (no database)
- **Logs:** `logs/generations/<timestamp>-<id>.jsonl` — every prompt and response captured for review

## Evals

Five test cases in `evals/cases/` — varied agents, listing counts, geographies, and tones — exercised against six deterministic rubric checks per case (`evals/rubric.ts`):

1. **required-blocks** — `hero`, `agent-bio`, `contact` always present; `featured-listings` required when input has listings
2. **no-empty-content** — every block's primary fields are non-empty
3. **agent-name-in-bio** — the agent's name appears in the bio block
4. **listing-facts-mentioned** — each input listing's price, street, or neighborhood appears somewhere in the rendered output
5. **word-counts** — sane bounds per block (hero subheadline 3–60w, agent bio 20–300w, testimonial quotes 5–80w)
6. **schema-shapes** — collection fields are arrays of objects with the required keys

Run the harness:

```bash
npm run eval
```

The baseline run is committed at `evals/results/baseline.json` for inspection. Latest baseline: **30/30 checks passed**, ~9 s per case (Sonnet 4.6, system-prompt caching). Future eval runs are gitignored so the repo doesn't accumulate timestamped JSON; the runner exits non-zero on any failure (CI-ready).

## What's deliberately *not* here

- No database. Filesystem JSON keeps the architecture explicit and walkable.
- No authentication. Out of scope for a builder demo.
- No real Cloudinary integration. Placeholder image URLs.
- No reproduction of Luxury Presence's actual block markup, theme slugs, section UUIDs, CSS, or copy. The data shape mirrors theirs at the pattern level (theme slug + UUID-keyed sections), but every visible name and asset is original.
- No comprehensive test suite. The eval harness (`npm run eval`) exercises the AI generation path; that's what matters here.

## License

MIT — see [LICENSE](LICENSE).
