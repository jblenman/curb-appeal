import type { BlockType, SiteBlock, SiteConfig } from "../types";

export interface UniquenessResult {
  /** Overall lexical cosine similarity, 0 (distinct) to 1 (identical copy). */
  overlap: number;
  /** Marketing clichés appearing in BOTH sites — the convergence signal. */
  sharedCliches: string[];
  perSection: { type: BlockType; overlap: number }[];
}

const STOPWORDS = new Set(
  "the a an and or of to in for with your you our we is are was on at by from this that as it be will can has have their her his its".split(
    /\s+/,
  ),
);

// Real-estate marketing clichés, including the recurring phrases the landscape
// survey flagged as cross-tenant boilerplate.
const CLICHES = [
  "unparalleled",
  "world-class",
  "white-glove",
  "above and beyond",
  "boutique",
  "luxury living",
  "dream home",
  "one of a kind",
  "second to none",
  "attention to detail",
  "unmatched",
  "prestigious",
  "exquisite",
  "nestled",
  "tranquil oasis",
  "pride of ownership",
  "turnkey",
  "must see",
  "breathtaking",
  "personalized service",
  "trusted advisor",
  "exceptional service",
];

function blockText(block: SiteBlock): string {
  const parts: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") parts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(block.content);
  return parts.join(" ");
}

function siteText(site: SiteConfig): string {
  return site.blocks.map(blockText).join(" ");
}

function tokenize(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  return words.filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function termFreq(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const v of a.values()) na += v * v;
  for (const v of b.values()) nb += v * v;
  for (const [k, v] of a) {
    const w = b.get(k);
    if (w) dot += v * w;
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

function textCosine(t1: string, t2: string): number {
  return cosine(termFreq(tokenize(t1)), termFreq(tokenize(t2)));
}

/**
 * Lexical uniqueness between two generated sites. Lexical (not embedding-based)
 * by design: the convergence concern is literal phrase/word reuse, which this
 * measures directly and for free. Swapping in an embeddings provider (Voyage /
 * OpenAI) for a semantic score is a drop-in upgrade.
 */
export function compareSites(a: SiteConfig, b: SiteConfig): UniquenessResult {
  const textA = siteText(a);
  const textB = siteText(b);
  const lowerA = textA.toLowerCase();
  const lowerB = textB.toLowerCase();

  const sharedCliches = CLICHES.filter((c) => lowerA.includes(c) && lowerB.includes(c));

  const aByType = new Map<BlockType, SiteBlock>(a.blocks.map((bl) => [bl.type, bl]));
  const perSection: { type: BlockType; overlap: number }[] = [];
  for (const bl of b.blocks) {
    const counterpart = aByType.get(bl.type);
    if (counterpart) {
      perSection.push({
        type: bl.type,
        overlap: textCosine(blockText(counterpart), blockText(bl)),
      });
    }
  }

  return { overlap: textCosine(textA, textB), sharedCliches, perSection };
}
