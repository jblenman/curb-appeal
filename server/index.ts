// IMPORTANT: dotenv must load before any module that reads process.env at import time
// (notably ./generate.js, which instantiates the Anthropic client at module-load).
// `dotenv/config` is the side-effect import that runs config() immediately.
import "dotenv/config";
import express from "express";
import { generateSite, generateSiteFromPersona } from "./generate.js";
import { checkRateLimit, clientIp, getCached, setCached } from "./guard.js";

const app = express();
// Don't advertise the server framework (defensive hygiene — Phase 1).
// In production the Vercel handler (api/generate.ts) is non-Express and
// doesn't emit this header; security headers there come from vercel.json.
app.disable("x-powered-by");
const port = Number(process.env.API_PORT) || 8787;

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6" });
});

app.post("/api/generate", async (req, res) => {
  try {
    const body = (req.body ?? {}) as { persona?: unknown };
    const persona =
      typeof body.persona === "string" && body.persona.trim()
        ? body.persona.trim()
        : null;

    if (persona) {
      const hit = getCached(persona);
      if (hit) {
        res.json({ ...hit, cached: true });
        return;
      }
    }

    const rl = checkRateLimit(clientIp(req.headers, req.socket.remoteAddress));
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
    res.json(result);
  } catch (err) {
    console.error("[generate] error:", err);
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.listen(port, () => {
  console.log(`curb-appeal API listening on http://localhost:${port}`);
});
