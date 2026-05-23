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
}
