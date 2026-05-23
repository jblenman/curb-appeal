import type {
  AgentBioBlockContent,
  ContactBlockContent,
  FeaturedListingsBlockContent,
  GenerationInput,
  HeroBlockContent,
  SiteConfig,
  TestimonialsBlockContent,
} from "../src/types.js";

export interface CheckResult {
  name: string;
  passed: boolean;
  detail?: string;
}

export function runRubric(input: GenerationInput, output: SiteConfig): CheckResult[] {
  return [
    checkRequiredBlocks(input, output),
    checkNoEmptyContent(output),
    checkAgentNameInBio(input, output),
    checkListingFactsMentioned(input, output),
    checkWordCounts(output),
    checkSchemaShapes(output),
  ];
}

// 1. Required blocks present.
// hero + agent-bio + contact are mandatory. featured-listings required if input has listings.
function checkRequiredBlocks(input: GenerationInput, output: SiteConfig): CheckResult {
  const types = new Set(output.blocks.map((b) => b.type));
  const required = ["hero", "agent-bio", "contact"];
  if (input.listings.length > 0) required.push("featured-listings");
  const missing = required.filter((r) => !types.has(r as never));
  return {
    name: "required-blocks",
    passed: missing.length === 0,
    detail: missing.length === 0 ? undefined : `missing: ${missing.join(", ")}`,
  };
}

// 2. No empty content in any block's primary fields.
function checkNoEmptyContent(output: SiteConfig): CheckResult {
  const failures: string[] = [];
  for (const block of output.blocks) {
    switch (block.type) {
      case "hero": {
        const c = block.content as HeroBlockContent;
        if (!c.headline?.trim()) failures.push("hero.headline");
        if (!c.subheadline?.trim()) failures.push("hero.subheadline");
        break;
      }
      case "featured-listings": {
        const c = block.content as FeaturedListingsBlockContent;
        if (!c.headline?.trim()) failures.push("featured-listings.headline");
        if (!c.items?.length) failures.push("featured-listings.items");
        break;
      }
      case "agent-bio": {
        const c = block.content as AgentBioBlockContent;
        if (!c.headline?.trim()) failures.push("agent-bio.headline");
        if (!c.bodyMarkdown?.trim()) failures.push("agent-bio.bodyMarkdown");
        break;
      }
      case "testimonials": {
        const c = block.content as TestimonialsBlockContent;
        if (!c.headline?.trim()) failures.push("testimonials.headline");
        if (!c.items?.length) failures.push("testimonials.items");
        break;
      }
      case "contact": {
        const c = block.content as ContactBlockContent;
        if (!c.headline?.trim()) failures.push("contact.headline");
        if (!c.ctaText?.trim()) failures.push("contact.ctaText");
        if (!c.fields?.length) failures.push("contact.fields");
        break;
      }
    }
  }
  return {
    name: "no-empty-content",
    passed: failures.length === 0,
    detail: failures.length === 0 ? undefined : `empty: ${failures.join(", ")}`,
  };
}

// 3. Agent's name appears in the bio block (in either the headline or the body).
function checkAgentNameInBio(input: GenerationInput, output: SiteConfig): CheckResult {
  const bio = output.blocks.find((b) => b.type === "agent-bio");
  if (!bio) {
    return { name: "agent-name-in-bio", passed: false, detail: "no agent-bio block" };
  }
  const c = bio.content as AgentBioBlockContent;
  const haystack = `${c.headline ?? ""} ${c.bodyMarkdown ?? ""}`.toLowerCase();
  const name = input.agent.name.toLowerCase();
  const firstName = name.split(/\s+/)[0];
  const passed = haystack.includes(name) || haystack.includes(firstName);
  return {
    name: "agent-name-in-bio",
    passed,
    detail: passed ? undefined : `"${input.agent.name}" not found in bio`,
  };
}

// 4. For each input listing, at least one of {price, street segment, neighborhood} appears
// somewhere in the rendered content.
function checkListingFactsMentioned(input: GenerationInput, output: SiteConfig): CheckResult {
  if (input.listings.length === 0) {
    return { name: "listing-facts-mentioned", passed: true, detail: "no listings to check" };
  }
  const haystack = JSON.stringify(output.blocks).toLowerCase();
  const missing: string[] = [];
  for (const listing of input.listings) {
    const priceDigits = listing.price.replace(/[^\d]/g, "");
    const streetSegment = listing.address.split(",")[0].toLowerCase();
    const neighborhood = (listing.neighborhood ?? "").toLowerCase();
    const found =
      (priceDigits && haystack.replace(/[^\d]/g, "").includes(priceDigits)) ||
      haystack.includes(streetSegment) ||
      (neighborhood && haystack.includes(neighborhood));
    if (!found) {
      missing.push(`"${listing.address}" ($${priceDigits})`);
    }
  }
  return {
    name: "listing-facts-mentioned",
    passed: missing.length === 0,
    detail: missing.length === 0 ? undefined : `unmentioned: ${missing.join("; ")}`,
  };
}

// 5. Word counts within sane bounds per block type.
function checkWordCounts(output: SiteConfig): CheckResult {
  const violations: string[] = [];
  const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

  for (const block of output.blocks) {
    if (block.type === "hero") {
      const c = block.content as HeroBlockContent;
      const wc = wordCount(c.subheadline ?? "");
      if (wc < 3 || wc > 60) violations.push(`hero.subheadline=${wc}w`);
    } else if (block.type === "agent-bio") {
      const c = block.content as AgentBioBlockContent;
      const wc = wordCount(c.bodyMarkdown ?? "");
      if (wc < 20 || wc > 300) violations.push(`agent-bio.bodyMarkdown=${wc}w`);
    } else if (block.type === "testimonials") {
      const c = block.content as TestimonialsBlockContent;
      for (const [i, t] of (c.items ?? []).entries()) {
        const wc = wordCount(t.quote ?? "");
        if (wc < 5 || wc > 80) violations.push(`testimonials[${i}].quote=${wc}w`);
      }
    }
  }
  return {
    name: "word-counts",
    passed: violations.length === 0,
    detail: violations.length === 0 ? undefined : violations.join(", "),
  };
}

// 6. Schema shapes — collection fields are arrays of objects with required keys.
function checkSchemaShapes(output: SiteConfig): CheckResult {
  const violations: string[] = [];
  for (const block of output.blocks) {
    if (block.type === "featured-listings") {
      const c = block.content as FeaturedListingsBlockContent;
      if (!Array.isArray(c.items)) {
        violations.push("featured-listings.items not an array");
      } else {
        c.items.forEach((item, i) => {
          for (const key of ["price", "address", "beds", "baths", "sqft"]) {
            if (item[key as keyof typeof item] === undefined || item[key as keyof typeof item] === null) {
              violations.push(`featured-listings.items[${i}].${key} missing`);
            }
          }
        });
      }
    } else if (block.type === "testimonials") {
      const c = block.content as TestimonialsBlockContent;
      if (!Array.isArray(c.items)) {
        violations.push("testimonials.items not an array");
      } else {
        c.items.forEach((t, i) => {
          if (!t.quote || !t.attribution) {
            violations.push(`testimonials.items[${i}] missing quote/attribution`);
          }
        });
      }
    } else if (block.type === "contact") {
      const c = block.content as ContactBlockContent;
      if (!Array.isArray(c.fields)) {
        violations.push("contact.fields not an array");
      } else {
        c.fields.forEach((f, i) => {
          if (!f.name || !f.label) {
            violations.push(`contact.fields[${i}] missing name/label`);
          }
        });
      }
    }
  }
  return {
    name: "schema-shapes",
    passed: violations.length === 0,
    detail: violations.length === 0 ? undefined : violations.join(", "),
  };
}
