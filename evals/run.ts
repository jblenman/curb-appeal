// Eval harness — runs every case in evals/cases/ through the AI generation
// pipeline, applies the deterministic rubric, prints a pass/fail matrix,
// writes a JSON results file, and exits non-zero on any failure.
//
// Usage: npm run eval
//
// Cost note: each case makes ~6 Claude API calls (1 block-selection + 1 per
// generated block). At Sonnet 4.6 pricing, expect roughly $0.05-0.10 per case
// before prompt caching, less after. Six cases ≈ $0.30-0.60 per full run.

import "dotenv/config";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateSite } from "../server/generate.js";
import { runRubric, type CheckResult } from "./rubric.js";
import type { GenerationInput, SiteConfig } from "../src/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CASES_DIR = join(__dirname, "cases");
const RESULTS_DIR = join(__dirname, "results");

interface CaseResult {
  file: string;
  latencyMs: number;
  blockTypes?: string[];
  checks?: CheckResult[];
  error?: string;
}

async function main(): Promise<void> {
  const files = (await readdir(CASES_DIR))
    .filter((f) => f.endsWith(".json"))
    .sort();

  if (files.length === 0) {
    console.error(`No .json cases found in ${CASES_DIR}`);
    process.exit(1);
  }

  console.log(`Running ${files.length} case${files.length === 1 ? "" : "s"}\n`);

  const results: CaseResult[] = [];

  for (const file of files) {
    const input = JSON.parse(
      await readFile(join(CASES_DIR, file), "utf-8"),
    ) as GenerationInput;
    process.stdout.write(`▶ ${file} ... `);
    const t0 = Date.now();
    let output: SiteConfig | undefined;
    let error: string | undefined;
    try {
      output = await generateSite(input);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    const latencyMs = Date.now() - t0;

    if (output) {
      const checks = runRubric(input, output);
      const passed = checks.filter((c) => c.passed).length;
      const total = checks.length;
      const status = passed === total ? "PASS" : "FAIL";
      console.log(`${status} (${passed}/${total}, ${latencyMs}ms)`);
      for (const c of checks) {
        const mark = c.passed ? "  ✓" : "  ✗";
        const detail = c.detail ? ` — ${c.detail}` : "";
        console.log(`${mark} ${c.name}${detail}`);
      }
      results.push({
        file,
        latencyMs,
        blockTypes: output.blocks.map((b) => b.type),
        checks,
      });
    } else {
      console.log(`ERROR (${latencyMs}ms)`);
      console.log(`  ${error}`);
      results.push({ file, latencyMs, error });
    }
    console.log();
  }

  // Aggregate summary
  const totalChecks = results.reduce(
    (acc, r) => acc + (r.checks?.length ?? 0),
    0,
  );
  const passedChecks = results.reduce(
    (acc, r) => acc + (r.checks?.filter((c) => c.passed).length ?? 0),
    0,
  );
  const errored = results.filter((r) => r.error).length;
  const cases = results.length;

  console.log("─".repeat(60));
  console.log(
    `Summary: ${passedChecks}/${totalChecks} checks across ${cases} case${cases === 1 ? "" : "s"}` +
      (errored > 0 ? `  (${errored} errored before rubric ran)` : ""),
  );

  // Persist results
  await mkdir(RESULTS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const resultPath = join(RESULTS_DIR, `${ts}.json`);
  await writeFile(
    resultPath,
    JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2),
    "utf-8",
  );
  console.log(`Results: ${resultPath}`);

  process.exit(passedChecks === totalChecks && errored === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Eval runner crashed:", err);
  process.exit(2);
});
