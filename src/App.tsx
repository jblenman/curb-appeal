import { useState } from "react";
import { SiteRenderer } from "./components/SiteRenderer";
import { TelemetryOverlay } from "./components/TelemetryOverlay";
import { generateFromPersona } from "./lib/api";
import type { SiteConfig } from "./types";

const EXAMPLES = [
  "Luxury agent in Aspen specializing in mountain ski properties",
  "Family-focused team in Plano serving Collin County",
  "Boutique broker in Soho focused on prewar buildings",
];

export default function App() {
  const [persona, setPersona] = useState("");
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(p: string) {
    const text = p.trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    try {
      const result = await generateFromPersona(text);
      setConfig(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

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

      {!config && !loading && (
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
      )}

      {error && <div className="error">Error: {error}</div>}

      {loading && !config && (
        <div className="empty">
          <p>Composing a site for this persona — routing across models…</p>
        </div>
      )}

      {!config && !error && !loading && (
        <div className="empty">
          <p>
            Enter an agent persona and watch the AI compose a site — different every time.
          </p>
          <p style={{ fontSize: "0.9rem" }}>
            Configure your API key in <code>.env</code> first (see README).
          </p>
        </div>
      )}

      {config && <SiteRenderer config={config} />}
      {config?.telemetry && (
        <TelemetryOverlay telemetry={config.telemetry} persona={config.persona} />
      )}
    </>
  );
}
