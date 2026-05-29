// Belt-and-suspenders: also load dotenv here in case generate.ts is imported
// from a different entry point (e.g. evals/run.ts) that doesn't pre-load it.
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  BlockType,
  GenerationInput,
  GenerationTelemetry,
  SiteBlock,
  SiteConfig,
  TelemetryStep,
} from "../src/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = join(__dirname, "..", "logs", "generations");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// --- Multi-model routing -----------------------------------------------------
// A cheap/fast model handles classification-style steps (block selection); a
// stronger model writes the customer-facing copy and expands the persona.
// Each is overridable via env so a constrained deploy or the eval harness can
// pin specific models. ANTHROPIC_MODEL stays supported as the content default
// for backward compatibility.
const MODELS = {
  triage: process.env.MODEL_TRIAGE || "claude-haiku-4-5",
  content:
    process.env.MODEL_CONTENT || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
};

// --- Pricing (USD per million tokens) ----------------------------------------
// Only used to surface an *estimated* per-generation cost in the demo overlay.
interface Price {
  in: number;
  out: number;
  cacheWrite: number;
  cacheRead: number;
}
const PRICING: Record<string, Price> = {
  "claude-haiku-4-5": { in: 1, out: 5, cacheWrite: 1.25, cacheRead: 0.1 },
  "claude-sonnet-4-6": { in: 3, out: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  "claude-opus-4-8": { in: 5, out: 25, cacheWrite: 6.25, cacheRead: 0.5 },
};

function costUsd(
  model: string,
  u: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  },
): number {
  // Unknown/aliased ids fall back to Sonnet pricing so cost is never NaN.
  const p = PRICING[model] ?? PRICING["claude-sonnet-4-6"];
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const cacheWrite = u.cache_creation_input_tokens ?? 0;
  return (
    (u.input_tokens * p.in +
      u.output_tokens * p.out +
      cacheRead * p.cacheRead +
      cacheWrite * p.cacheWrite) /
    1_000_000
  );
}

const BLOCK_CATALOGUE = `
Available block types:

- "hero": Above-fold tagline + image. Fields: headline, subheadline, ctaText, imageUrl.
- "featured-listings": Up to 3 highlighted listings drawn from the input. Fields: headline, items[] (price, address, beds, baths, sqft, imageUrl).
- "agent-bio": Short biography. Fields: headline, bodyMarkdown, headshotUrl, yearsExperience, credentials[].
- "testimonials": 2-3 client quotes (invent plausibly grounded in agent context). Fields: headline, items[] (quote, attribution).
- "contact": Capture-form CTA. Fields: headline, ctaText, fields[] (name, label, type, required).
`.trim();

interface GenerationLog {
  inputId: string;
  step: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  prompt: string;
  response: string;
  timestamp: string;
}

async function logGeneration(inputId: string, entry: GenerationLog): Promise<void> {
  // Best-effort: serverless filesystems (Vercel, Lambda, etc.) are read-only
  // outside /tmp. Don't let a missing log directory crash a real generation.
  try {
    await mkdir(LOGS_DIR, { recursive: true });
    const path = join(LOGS_DIR, `${Date.now()}-${inputId}.jsonl`);
    await writeFile(path, JSON.stringify(entry) + "\n", { flag: "a" });
  } catch (err) {
    console.warn(`[logGeneration] skipped (${(err as Error).message})`);
  }
}

function extractText(resp: Anthropic.Message): string {
  return resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

// Single funnel for every model call: runs the request, records a telemetry
// step (model/tokens/latency/cost), and writes the best-effort disk log.
interface CallArgs {
  step: string;
  label: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  inputId: string;
  steps: TelemetryStep[];
}

async function callModel(args: CallArgs): Promise<string> {
  const t0 = Date.now();
  const resp = await client.messages.create({
    model: args.model,
    max_tokens: args.maxTokens,
    system: [
      { type: "text", text: args.system, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: args.user }],
  });
  const latencyMs = Date.now() - t0;
  const text = extractText(resp);
  const u = resp.usage;

  args.steps.push({
    step: args.step,
    label: args.label,
    model: args.model,
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
    latencyMs,
    costUsd: costUsd(args.model, u),
  });

  await logGeneration(args.inputId, {
    inputId: args.inputId,
    step: args.step,
    model: args.model,
    promptTokens: u.input_tokens,
    completionTokens: u.output_tokens,
    latencyMs,
    prompt: args.system + "\n\n---\n\n" + args.user,
    response: text,
    timestamp: new Date().toISOString(),
  });

  return text;
}

// --- Persona expansion -------------------------------------------------------
// Turns a one-line free-text persona into the structured GenerationInput the
// rest of the pipeline already understands. This is what makes every persona
// produce a distinct site (instead of regenerating the same fixed sample).
const PERSONA_SCHEMA = `{
  "agent": { "name": string, "brokerage": string, "yearsExperience": number, "city": string, "bio": string },
  "listings": [ { "price": string, "address": string, "beds": number, "baths": number, "sqft": number, "description": string, "features": string[], "neighborhood": string, "imageUrl": string } ],
  "preferences": { "tone": "luxe" | "warm" | "professional" }
}`;

async function personaToInput(
  persona: string,
  inputId: string,
  steps: TelemetryStep[],
): Promise<GenerationInput> {
  const system = `You turn a one-line real-estate-agent persona into a realistic, internally-consistent structured profile for a demo website. Invent plausible, specific details grounded in the persona's market and specialty. Produce exactly 2-3 listings that fit the persona. Keep each listing description to 1-2 sentences and at most 4 features, so the full JSON fits in a single response. For every imageUrl, use "https://picsum.photos/seed/<unique-slug>/1200/800" with a distinct slug per image so images load and vary between sites. Choose a tone that matches the persona. Respond with ONLY a JSON object (no markdown fences) matching this schema:\n${PERSONA_SCHEMA}`;
  const user = `Persona: ${persona}\n\nGenerate the JSON profile.`;

  const text = await callModel({
    step: "persona-expansion",
    label: "Persona → profile",
    model: MODELS.content,
    system,
    user,
    maxTokens: 3000,
    inputId,
    steps,
  });

  // Be tolerant of markdown fences; fail loudly (with a snippet) if still unparseable.
  let body = text.trim();
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) body = fence[1].trim();
  const match = body.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Persona expansion returned no JSON object: " + text.slice(0, 300));
  }
  return JSON.parse(match[0]) as GenerationInput;
}

async function pickBlocks(
  input: GenerationInput,
  inputId: string,
  steps: TelemetryStep[],
): Promise<BlockType[]> {
  const system = `You are an architect for AI-generated real estate websites. Given listing data and an agent profile, decide which page sections to include and in what order.\n\n${BLOCK_CATALOGUE}\n\nRespond with ONLY a JSON array of block type strings in order. Example: ["hero","featured-listings","agent-bio","testimonials","contact"]`;

  const user = `Agent: ${JSON.stringify(input.agent, null, 2)}\n\nListings: ${JSON.stringify(input.listings, null, 2)}\n\nPreferences: ${JSON.stringify(input.preferences ?? {}, null, 2)}\n\nWhich blocks should this site have? JSON array only.`;

  const text = await callModel({
    step: "block-selection",
    label: "Block selection",
    model: MODELS.triage,
    system,
    user,
    maxTokens: 256,
    inputId,
    steps,
  });

  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) throw new Error("Block selection returned no JSON array: " + text);
  const parsed = JSON.parse(match[0]) as string[];
  return parsed.filter((t): t is BlockType =>
    ["hero", "featured-listings", "agent-bio", "testimonials", "contact"].includes(t),
  );
}

const SCHEMA_HINTS: Record<BlockType, string> = {
  hero: `{ "headline": string, "subheadline": string, "ctaText": string, "imageUrl": string }`,
  "featured-listings": `{ "headline": string, "items": [{"price": string, "address": string, "beds": number, "baths": number, "sqft": number, "imageUrl": string}] }  // 1-3 items, drawn from the listings input`,
  "agent-bio": `{ "headline": string, "bodyMarkdown": string, "headshotUrl": string, "yearsExperience": number, "credentials": string[] }`,
  testimonials: `{ "headline": string, "items": [{"quote": string, "attribution": string}] }  // 2-3 items, invent plausible client testimonials grounded in the agent's market`,
  contact: `{ "headline": string, "ctaText": string, "fields": [{"name": string, "label": string, "type": string, "required": boolean}] }`,
};

async function generateBlockContent(
  blockType: BlockType,
  input: GenerationInput,
  inputId: string,
  steps: TelemetryStep[],
): Promise<unknown> {
  const system = `You write copy for AI-generated real estate websites. For each block type, generate JSON content matching the schema. Be specific and grounded — do not invent facts that contradict the inputs (wrong neighborhood, wrong beds, wrong agent name). Tone: ${input.preferences?.tone ?? "professional"}. Respond with ONLY the JSON object.`;

  const user = `Block type: ${blockType}\nSchema: ${SCHEMA_HINTS[blockType]}\n\nAgent: ${JSON.stringify(input.agent, null, 2)}\nListings: ${JSON.stringify(input.listings, null, 2)}\n\nWrite the JSON content for this block.`;

  const text = await callModel({
    step: `copy:${blockType}`,
    label: `Copy — ${blockType}`,
    model: MODELS.content,
    system,
    user,
    maxTokens: 1024,
    inputId,
    steps,
  });

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`${blockType} content returned no JSON object: ${text}`);
  }
  return JSON.parse(match[0]);
}

function summarize(steps: TelemetryStep[], wallMs: number): GenerationTelemetry {
  const totals = steps.reduce(
    (a, s) => {
      a.inputTokens += s.inputTokens;
      a.outputTokens += s.outputTokens;
      a.cacheReadTokens += s.cacheReadTokens;
      a.cacheCreationTokens += s.cacheCreationTokens;
      a.costUsd += s.costUsd;
      return a;
    },
    {
      calls: steps.length,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      latencyMs: wallMs,
      costUsd: 0,
      cacheHitRate: 0,
    },
  );
  const cacheable = totals.inputTokens + totals.cacheReadTokens;
  totals.cacheHitRate = cacheable > 0 ? totals.cacheReadTokens / cacheable : 0;
  return { steps, totals };
}

function requireKey(): void {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in.",
    );
  }
}

// Shared core: block selection (triage model) → per-block copy (content model,
// parallel). The system prompt is identical across copy calls, so the prompt
// cache makes the fan-out cheap.
async function buildSite(
  input: GenerationInput,
  inputId: string,
  steps: TelemetryStep[],
): Promise<SiteConfig> {
  const blockTypes = await pickBlocks(input, inputId, steps);

  const blocks: SiteBlock[] = await Promise.all(
    blockTypes.map(async (type) => {
      const content = await generateBlockContent(type, input, inputId, steps);
      // The discriminated union is enforced by trust in the model's output
      // shape; the eval harness validates structurally.
      return { id: randomUUID(), type, content } as SiteBlock;
    }),
  );

  return {
    themeSlug: "modern-coastal",
    agent: input.agent,
    blocks,
    generatedAt: new Date().toISOString(),
  };
}

/** Structured-input entry point. Used by the eval harness and the legacy path. */
export async function generateSite(input: GenerationInput): Promise<SiteConfig> {
  requireKey();
  const inputId = randomUUID().slice(0, 8);
  const steps: TelemetryStep[] = [];
  const t0 = Date.now();
  const site = await buildSite(input, inputId, steps);
  return { ...site, telemetry: summarize(steps, Date.now() - t0) };
}

/** Free-text entry point: persona → structured input → site, with unified telemetry. */
export async function generateSiteFromPersona(persona: string): Promise<SiteConfig> {
  requireKey();
  const inputId = randomUUID().slice(0, 8);
  const steps: TelemetryStep[] = [];
  const t0 = Date.now();
  const input = await personaToInput(persona, inputId, steps);
  const site = await buildSite(input, inputId, steps);
  return { ...site, persona, telemetry: summarize(steps, Date.now() - t0) };
}
