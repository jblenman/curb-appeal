// Shared request handler for /api/generate, used by both the Vercel serverless
// function (api/generate.ts) and the local Express dev server (server/index.ts).
// Typed against Node's ServerResponse, which both Vercel's and Express's response
// objects extend — so the streaming + guard logic lives in exactly one place.
import type { ServerResponse } from "node:http";
import {
  generateSite,
  generateSiteFromPersona,
  generateSiteStream,
} from "./generate.js";
import { checkRateLimit, getCached, setCached } from "./guard.js";
import type { GenerationInput, SiteConfig } from "../src/types.js";

export interface GenRequest {
  body: unknown;
  /** Pre-resolved client IP (each entry point derives it from its own request). */
  ip: string;
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function setNdjsonHeaders(res: ServerResponse): void {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no"); // discourage proxy buffering
}

/** Replay a cached site as the same event sequence a fresh stream would emit. */
function streamCached(res: ServerResponse, hit: SiteConfig): void {
  setNdjsonHeaders(res);
  const w = (e: unknown) => res.write(JSON.stringify(e) + "\n");
  w({ type: "persona", agent: hit.agent });
  if (hit.telemetry) for (const s of hit.telemetry.steps) w({ type: "step", step: s });
  w({ type: "blocks", order: hit.blocks.map((b) => b.type) });
  for (const b of hit.blocks) w({ type: "block", block: b });
  w({ type: "done", site: { ...hit, cached: true } });
  res.end();
}

export async function handleGenerate(req: GenRequest, res: ServerResponse): Promise<void> {
  const body = (req.body ?? {}) as { persona?: unknown; stream?: unknown };
  const persona =
    typeof body.persona === "string" && body.persona.trim() ? body.persona.trim() : null;
  const streaming = body.stream === true || body.stream === "1";

  try {
    // Cache hits are free and skip the rate limit.
    if (persona) {
      const hit = getCached(persona);
      if (hit) {
        if (streaming) streamCached(res, hit);
        else sendJson(res, 200, { ...hit, cached: true });
        return;
      }
    }

    const rl = checkRateLimit(req.ip);
    if (!rl.ok) {
      res.setHeader("Retry-After", String(rl.retryAfterSec ?? 60));
      sendJson(res, 429, { error: `Rate limit reached — try again in ~${rl.retryAfterSec}s.` });
      return;
    }

    if (streaming && persona) {
      setNdjsonHeaders(res);
      let site: SiteConfig | null = null;
      try {
        for await (const ev of generateSiteStream(persona)) {
          res.write(JSON.stringify(ev) + "\n");
          if (ev.type === "done") site = ev.site;
        }
      } catch (err) {
        // The stream already started, so report the failure as a terminal event.
        res.write(
          JSON.stringify({
            type: "error",
            message: err instanceof Error ? err.message : String(err),
          }) + "\n",
        );
      }
      if (site) setCached(persona, site);
      res.end();
      return;
    }

    const result = persona
      ? await generateSiteFromPersona(persona)
      : await generateSite(req.body as GenerationInput);
    if (persona) setCached(persona, result);
    sendJson(res, 200, result);
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}
