import express from "express";
import { config as dotenvConfig } from "dotenv";
import { generateSite } from "./generate.js";

dotenvConfig();

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
