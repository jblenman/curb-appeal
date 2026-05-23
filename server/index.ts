// IMPORTANT: dotenv must load before any module that reads process.env at import time
// (notably ./generate.js, which instantiates the Anthropic client at module-load).
// `dotenv/config` is the side-effect import that runs config() immediately.
import "dotenv/config";
import express from "express";
import { generateSite } from "./generate.js";

const app = express();
const port = Number(process.env.API_PORT) || 8787;

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6" });
});

app.post("/api/generate", async (req, res) => {
  try {
    const result = await generateSite(req.body);
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
