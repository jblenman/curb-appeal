// Vercel serverless function — POST /api/generate
// Reuses the same `generateSite()` core that the local Express server uses.
// In production (Vercel), the Express server in server/index.ts is unused;
// in local dev, Vite proxies /api/generate to the Express server and this
// file is never invoked.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateSite } from "../server/generate.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  try {
    const result = await generateSite(req.body);
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
