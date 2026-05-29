import { useState } from "react";
import { SiteRenderer } from "./components/SiteRenderer";
import { TelemetryOverlay } from "./components/TelemetryOverlay";
import { streamFromPersona } from "./lib/api";
import { compareSites, type UniquenessResult } from "./lib/uniqueness";
import type {
  BlockType,
  GenerationTelemetry,
  RefinementRecord,
  SiteBlock,
  SiteConfig,
  TelemetryStep,
} from "./types";

const EXAMPLES = [
  "Luxury agent in Aspen specializing in mountain ski properties",
  "Family-focused team in Plano serving Collin County",
  "Boutique broker in Soho focused on prewar buildings",
];

type Phase = "idle" | "expanding" | "building" | "done";

function runningTelemetry(
  steps: TelemetryStep[],
  wallMs: number,
  refinements: RefinementRecord[],
): GenerationTelemetry {
  const totals = steps.reduce(
    (a, s) => {
      a.inputTokens += s.inputTokens;
      a.outputTokens += s.outputTokens;
      a.cacheReadTokens += s.cacheReadTokens;
      a.cacheCreationTokens += s.cacheCreationTokens;
      a.costUsd += s.costUsd;
      return a;
    },
    {
      calls: steps.length,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      latencyMs: wallMs,
      costUsd: 0,
      cacheHitRate: 0,
    },
  );
  const cacheable = totals.inputTokens + totals.cacheReadTokens;
  totals.cacheHitRate = cacheable > 0 ? totals.cacheReadTokens / cacheable : 0;
  return {
    steps: [...steps],
    totals,
    refinements: refinements.length ? [...refinements] : undefined,
  };
}

export default function App() {
  const [persona, setPersona] = useState("");
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [order, setOrder] = useState<BlockType[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [uniqueness, setUniqueness] = useState<UniquenessResult | null>(null);
  const [prevPersona, setPrevPersona] = useState("");

  async function generate(p: string) {
    const text = p.trim();
    if (!text) return;
    // Compare the upcoming site against the last completed one (free, client-side).
    const prior =
      phase === "done" && config && config.persona && config.persona !== text ? config : null;
    setError(null);
    setUniqueness(null);
    setConfig(null);
    setOrder([]);
    setPhase("expanding");

    const start = Date.now();
    const steps: TelemetryStep[] = [];
    const refinements: RefinementRecord[] = [];
    let agent: SiteConfig["agent"] | undefined;
    let blockOrder: BlockType[] = [];
    const byType = new Map<BlockType, SiteBlock>();

    const apply = () => {
      if (!agent) return;
      const blocks = blockOrder
        .map((t) => byType.get(t))
        .filter((b): b is SiteBlock => Boolean(b));
      setConfig({
        themeSlug: "modern-coastal",
        agent,
        blocks,
        generatedAt: "",
        persona: text,
        telemetry: runningTelemetry(steps, Date.now() - start, refinements),
      });
    };

    try {
      await streamFromPersona(text, (e) => {
        switch (e.type) {
          case "persona":
            agent = e.agent;
            setPhase("building");
            apply();
            break;
          case "blocks":
            blockOrder = e.order;
            setOrder(e.order);
            apply();
            break;
          case "step":
            steps.push(e.step);
            apply();
            break;
          case "block":
            byType.set(e.block.type, e.block);
            apply();
            break;
          case "block-error":
            // Non-fatal: leave the section out and keep assembling.
            console.warn(`block ${e.blockType} failed: ${e.message}`);
            break;
          case "refine":
            refinements.push({
              blockType: e.blockType,
              initialScore: e.initialScore,
              finalScore: e.finalScore,
              rounds: e.rounds,
            });
            apply();
            break;
          case "done":
            setConfig(e.site);
            setOrder(e.site.blocks.map((b) => b.type));
            setPhase("done");
            if (prior) {
              setUniqueness(compareSites(prior, e.site));
              setPrevPersona(prior.persona ?? "previous site");
            }
            break;
          case "error":
            setError(e.message);
            setPhase("idle");
            break;
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("idle");
    }
  }

  const loading = phase === "expanding" || phase === "building";
  const arrived = new Set((config?.blocks ?? []).map((b) => b.type));

  return (
    <>
      <header className="app-header">
        <h1>curb-appeal</h1>
        <div className="persona-bar">
          <input
            className="persona-input"
            type="text"
            placeholder="Describe an agent — e.g. 'luxury agent in Aspen specializing in ski properties'"
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") generate(persona);
            }}
            disabled={loading}
          />
          <button onClick={() => generate(persona)} disabled={loading || !persona.trim()}>
            {loading ? "Generating…" : "Generate"}
          </button>
        </div>
      </header>

      {phase === "idle" && !config && !error && (
        <>
          <div className="examples">
            <span className="examples-label">Try one:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                className="example-chip"
                onClick={() => {
                  setPersona(ex);
                  generate(ex);
                }}
              >
                {ex}
              </button>
            ))}
          </div>
          <div className="empty">
            <p>
              Enter an agent persona and watch the AI compose a site, section by section —
              different every time.
            </p>
            <p style={{ fontSize: "0.9rem" }}>
              Configure your API key in <code>.env</code> first (see README).
            </p>
          </div>
        </>
      )}

      {error && <div className="error">Error: {error}</div>}

      {phase === "expanding" && (
        <div className="empty">
          <p>Expanding the persona into an agent profile…</p>
        </div>
      )}

      {phase === "building" && order.length > 0 && (
        <div className="stream-status">
          {order.map((t) => (
            <span key={t} className={arrived.has(t) ? "seg done" : "seg pending"}>
              {arrived.has(t) ? "✓" : "⋯"} {t}
            </span>
          ))}
        </div>
      )}

      {phase === "done" && uniqueness && (
        <div
          className={
            "uniqueness " +
            (uniqueness.overlap < 0.25 ? "good" : uniqueness.overlap < 0.5 ? "mid" : "bad")
          }
        >
          <strong>Uniqueness</strong> vs “{prevPersona}”:{" "}
          {Math.round(uniqueness.overlap * 100)}% lexical overlap ·{" "}
          {uniqueness.sharedCliches.length === 0
            ? "no shared clichés — distinct ✓"
            : `shared clichés: ${uniqueness.sharedCliches.join(", ")}`}
        </div>
      )}

      {config && <SiteRenderer config={config} />}
      {config?.telemetry && (
        <TelemetryOverlay
          telemetry={config.telemetry}
          persona={config.persona}
          cached={config.cached}
        />
      )}
    </>
  );
}
