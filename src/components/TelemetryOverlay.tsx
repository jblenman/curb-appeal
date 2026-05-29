import { useState } from "react";
import type { GenerationTelemetry } from "../types";

function shortModel(m: string): string {
  return m.replace("claude-", "");
}

function fmtUsd(n: number): string {
  return "$" + n.toFixed(n < 0.01 ? 4 : 3);
}

/**
 * Always-on (dismissable) overlay that makes the AI work visible: per-step
 * model routing, tokens, latency, and estimated cost, plus run totals.
 */
export function TelemetryOverlay({
  telemetry,
  persona,
  cached,
}: {
  telemetry: GenerationTelemetry;
  persona?: string;
  cached?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const t = telemetry.totals;

  if (!open) {
    return (
      <button className="telemetry-toggle" onClick={() => setOpen(true)}>
        ⚡ telemetry · {fmtUsd(t.costUsd)}
      </button>
    );
  }

  return (
    <aside className="telemetry" aria-label="AI generation telemetry">
      <div className="telemetry-head">
        <strong>AI generation telemetry</strong>
        <button
          className="telemetry-close"
          onClick={() => setOpen(false)}
          aria-label="Hide telemetry"
        >
          ×
        </button>
      </div>

      {persona && <div className="telemetry-persona">“{persona}”</div>}

      <div className="telemetry-totals">
        <span>{t.calls} calls</span>
        <span>{(t.latencyMs / 1000).toFixed(1)}s wall</span>
        <span>
          {t.inputTokens.toLocaleString()} in → {t.outputTokens.toLocaleString()} out
        </span>
        <span>{Math.round(t.cacheHitRate * 100)}% cache</span>
        <span className="telemetry-cost">{fmtUsd(t.costUsd)}</span>
        {cached && <span className="telemetry-cached">⚡ cached · $0 new</span>}
      </div>

      <table className="telemetry-steps">
        <thead>
          <tr>
            <th>step</th>
            <th>model</th>
            <th>in/out</th>
            <th>ms</th>
            <th>$</th>
          </tr>
        </thead>
        <tbody>
          {telemetry.steps.map((s, i) => (
            <tr key={`${s.step}-${i}`}>
              <td>{s.label}</td>
              <td>{shortModel(s.model)}</td>
              <td>
                {s.inputTokens}/{s.outputTokens}
              </td>
              <td>{s.latencyMs}</td>
              <td>{fmtUsd(s.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </aside>
  );
}
