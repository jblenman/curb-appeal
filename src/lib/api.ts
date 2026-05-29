import type { GenerationInput, SiteConfig } from "../types";

async function postGenerate(body: unknown): Promise<SiteConfig> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    let message = `API ${res.status}: ${text}`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error) message = parsed.error;
    } catch {
      /* not JSON — keep the raw text */
    }
    throw new Error(message);
  }
  return res.json();
}

/** Structured-input generation (legacy / sample path). */
export function generateSite(input: GenerationInput): Promise<SiteConfig> {
  return postGenerate(input);
}

/** Free-text persona generation — the primary demo flow. */
export function generateFromPersona(persona: string): Promise<SiteConfig> {
  return postGenerate({ persona });
}
