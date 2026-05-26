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
  SiteBlock,
  SiteConfig,
} from "../src/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = join(__dirname, "..", "logs", "generations");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

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
  step: "block-selection" | "copy-generation";
  blockType?: BlockType;
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

async function pickBlocks(
  input: GenerationInput,
  inputId: string,
): Promise<BlockType[]> {
  const system = `You are an architect for AI-generated real estate websites. Given listing data and an agent profile, decide which page sections to include and in what order.\n\n${BLOCK_CATALOGUE}\n\nRespond with ONLY a JSON array of block type strings in order. Example: ["hero","featured-listings","agent-bio","testimonials","contact"]`;

  const user = `Agent: ${JSON.stringify(input.agent, null, 2)}\n\nListings: ${JSON.stringify(input.listings, null, 2)}\n\nPreferences: ${JSON.stringify(input.preferences ?? {}, null, 2)}\n\nWhich blocks should this site have? JSON array only.`;

  const t0 = Date.now();
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });
  const latency = Date.now() - t0;
  const text = extractText(resp);

  await logGeneration(inputId, {
    inputId,
    step: "block-selection",
    model: MODEL,
    promptTokens: resp.usage.input_tokens,
    completionTokens: resp.usage.output_tokens,
    latencyMs: latency,
    prompt: system + "\n\n---\n\n" + user,
    response: text,
    timestamp: new Date().toISOString(),
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
): Promise<unknown> {
  const system = `You write copy for AI-generated real estate websites. For each block type, generate JSON content matching the schema. Be specific and grounded — do not invent facts that contradict the inputs (wrong neighborhood, wrong beds, wrong agent name). Tone: ${input.preferences?.tone ?? "professional"}. Respond with ONLY the JSON object.`;

  const user = `Block type: ${blockType}\nSchema: ${SCHEMA_HINTS[blockType]}\n\nAgent: ${JSON.stringify(input.agent, null, 2)}\nListings: ${JSON.stringify(input.listings, null, 2)}\n\nWrite the JSON content for this block.`;

  const t0 = Date.now();
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });
  const latency = Date.now() - t0;
  const text = extractText(resp);

  await logGeneration(inputId, {
    inputId,
    step: "copy-generation",
    blockType,
    model: MODEL,
    promptTokens: resp.usage.input_tokens,
    completionTokens: resp.usage.output_tokens,
    latencyMs: latency,
    prompt: system + "\n\n---\n\n" + user,
    response: text,
    timestamp: new Date().toISOString(),
  });

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`${blockType} content returned no JSON object: ${text}`);
  }
  return JSON.parse(match[0]);
}

export async function generateSite(input: GenerationInput): Promise<SiteConfig> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in.",
    );
  }

  const inputId = randomUUID().slice(0, 8);
  const blockTypes = await pickBlocks(input, inputId);

  // Per-block copy generation runs in parallel — system prompt is identical for
  // each call so the prompt cache hit makes this cheap.
  const blocks: SiteBlock[] = await Promise.all(
    blockTypes.map(async (type) => {
      const content = await generateBlockContent(type, input, inputId);
      // The discriminated union here is enforced by trust in the model's output
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
