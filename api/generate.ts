// Vercel serverless function — POST /api/generate
// Reuses the same `generateSite()` core that the local Express server uses.
// In production (Vercel), the Express server in server/index.ts is unused;
// in local dev, Vite proxies /api/generate to the Express server and this
// file is never invoked.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateSite, generateSiteFromPersona } from "../server/generate.js";
import { checkRateLimit, clientIp, getCached, setCached } from "../server/guard.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  try {
    const body = (req.body ?? {}) as { persona?: unknown };
    const persona =
      typeof body.persona === "string" && body.persona.trim()
        ? body.persona.trim()
        : null;

    // Cache hits are free and skip the rate limit.
    if (persona) {
      const hit = getCached(persona);
      if (hit) {
        res.status(200).json({ ...hit, cached: true });
        return;
      }
    }

    const rl = checkRateLimit(clientIp(req.headers, req.socket?.remoteAddress));
    if (!rl.ok) {
      res.setHeader("Retry-After", String(rl.retryAfterSec ?? 60));
      res
        .status(429)
        .json({ error: `Rate limit reached — try again in ~${rl.retryAfterSec}s.` });
      return;
    }

    const result = persona
      ? await generateSiteFromPersona(persona)
      : await generateSite(req.body);
    if (persona) setCached(persona, result);
    res.status(200).json(result);
  } catch (err) {
    console.error("[api/generate] error:", err);
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
}

// Vercel function config — give the model time to do both passes.
// Default is 10s on the Hobby plan; this generation typically takes 8-12s.
export const config = {
  maxDuration: 30,
};
