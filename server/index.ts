// IMPORTANT: dotenv must load before any module that reads process.env at import
// time (notably ./generate.js, which instantiates the Anthropic client at
// module-load). `dotenv/config` is the side-effect import that runs config().
import "dotenv/config";
import express from "express";
import { handleGenerate } from "./handler.js";
import { clientIp } from "./guard.js";

const app = express();
// Don't advertise the server framework (defensive hygiene — Phase 1).
// In production the Vercel handler (api/generate.ts) is non-Express and doesn't
// emit this header; security headers there come from vercel.json.
app.disable("x-powered-by");
const port = Number(process.env.API_PORT) || 8787;

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6" });
});

app.post("/api/generate", async (req, res) => {
  await handleGenerate(
    { body: req.body, ip: clientIp(req.headers, req.socket.remoteAddress) },
    res,
  );
});

app.listen(port, () => {
  console.log(`curb-appeal API listening on http://localhost:${port}`);
});
