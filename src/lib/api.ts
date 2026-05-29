import type { GenerationInput, SiteConfig, StreamEvent } from "../types";

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

/** Free-text persona generation (non-streaming). */
export function generateFromPersona(persona: string): Promise<SiteConfig> {
  return postGenerate({ persona });
}

/**
 * Streaming persona generation — reads the NDJSON event stream and invokes
 * `onEvent` for each parsed event as it arrives.
 */
export async function streamFromPersona(
  persona: string,
  onEvent: (event: StreamEvent) => void,
): Promise<void> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persona, stream: true }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    let message = `API ${res.status}: ${text}`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error) message = parsed.error;
    } catch {
      /* keep raw */
    }
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) onEvent(JSON.parse(line) as StreamEvent);
    }
  }
  const tail = buffer.trim();
  if (tail) onEvent(JSON.parse(tail) as StreamEvent);
}
