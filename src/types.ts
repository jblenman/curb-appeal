// Shared types between client (src/) and server (server/).
// Server imports via relative path: `import type { ... } from "../src/types.js"`.

export type BlockType =
  | "hero"
  | "featured-listings"
  | "agent-bio"
  | "testimonials"
  | "contact";

export interface HeroBlockContent {
  headline: string;
  subheadline: string;
  ctaText?: string;
  imageUrl?: string;
}

export interface ListingItem {
  price: string;
  address: string;
  beds: number;
  baths: number;
  sqft: number;
  imageUrl?: string;
}

export interface FeaturedListingsBlockContent {
  headline: string;
  items: ListingItem[];
}

export interface AgentBioBlockContent {
  headline: string;
  bodyMarkdown: string;
  headshotUrl?: string;
  yearsExperience?: number;
  credentials?: string[];
}

export interface TestimonialItem {
  quote: string;
  attribution: string;
}

export interface TestimonialsBlockContent {
  headline: string;
  items: TestimonialItem[];
}

export interface ContactFormField {
  name: string;
  label: string;
  type: string;
  required?: boolean;
}

export interface ContactBlockContent {
  headline: string;
  ctaText: string;
  fields: ContactFormField[];
}

// Discriminated union — switch(block.type) narrows block.content correctly.
export type SiteBlock =
  | { id: string; type: "hero"; content: HeroBlockContent }
  | { id: string; type: "featured-listings"; content: FeaturedListingsBlockContent }
  | { id: string; type: "agent-bio"; content: AgentBioBlockContent }
  | { id: string; type: "testimonials"; content: TestimonialsBlockContent }
  | { id: string; type: "contact"; content: ContactBlockContent };

export interface AgentProfile {
  name: string;
  brokerage?: string;
  yearsExperience?: number;
  city?: string;
  email?: string;
  phone?: string;
  bio?: string;
}

export interface ListingInput {
  price: string;
  address: string;
  beds: number;
  baths: number;
  sqft: number;
  description?: string;
  features?: string[];
  neighborhood?: string;
  imageUrl?: string;
}

export interface GenerationInput {
  agent: AgentProfile;
  listings: ListingInput[];
  preferences?: {
    tone?: "luxe" | "warm" | "professional";
  };
}

export interface SiteConfig {
  themeSlug: string;
  agent: AgentProfile;
  blocks: SiteBlock[];
  generatedAt: string;
  /** Free-text persona that seeded this site (persona flow only). */
  persona?: string;
  /** Per-step model/token/latency/cost telemetry. Optional — the eval harness ignores it. */
  telemetry?: GenerationTelemetry;
  /** True when served from the in-memory persona cache (no new API spend). */
  cached?: boolean;
}

// --- Telemetry (surfaced to the demo overlay) --------------------------------

export interface TelemetryStep {
  /** Stable id, e.g. "persona-expansion", "block-selection", "copy:hero". */
  step: string;
  /** Human-friendly label for the overlay. */
  label: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  latencyMs: number;
  costUsd: number;
}

export interface GenerationTelemetry {
  steps: TelemetryStep[];
  totals: {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    /** Wall-clock total (less than the sum of step latencies, since copy runs in parallel). */
    latencyMs: number;
    costUsd: number;
    /** cacheRead / (cacheRead + input). */
    cacheHitRate: number;
  };
}

// --- Streaming protocol (NDJSON) ---------------------------------------------
// The persona endpoint can stream these events, one JSON object per line, so the
// UI assembles progressively instead of waiting for the whole site.

export type StreamEvent =
  | { type: "persona"; agent: AgentProfile }
  | { type: "blocks"; order: BlockType[] }
  | { type: "step"; step: TelemetryStep }
  | { type: "block"; block: SiteBlock }
  | { type: "block-error"; blockType: BlockType; message: string }
  | { type: "done"; site: SiteConfig }
  | { type: "error"; message: string };
