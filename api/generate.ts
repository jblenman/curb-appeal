// Vercel serverless function — POST /api/generate
// Thin wrapper over the shared handler (server/handler.ts); the same code runs
// behind the local Express dev server. Supports JSON and NDJSON streaming
// (when the request body includes { stream: true }).

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleGenerate } from "../server/handler.js";
import { clientIp } from "../server/guard.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }
  await handleGenerate(
    { body: req.body, ip: clientIp(req.headers, req.socket?.remoteAddress) },
    res,
  );
}

// Streaming holds the connection open for the full generation (~30s); give it
// headroom beyond the Hobby default.
export const config = {
  maxDuration: 60,
};
