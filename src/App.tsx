import { useState } from "react";
import { SiteRenderer } from "./components/SiteRenderer";
import { generateSite } from "./lib/api";
import sampleInput from "../data/samples/condo.json";
import type { SiteConfig, GenerationInput } from "./types";

export default function App() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const result = await generateSite(sampleInput as GenerationInput);
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
        <button onClick={handleGenerate} disabled={loading}>
          {loading ? "Generating..." : "Generate site"}
        </button>
      </header>
      {error && <div className="error">Error: {error}</div>}
      {!config && !error && !loading && (
        <div className="empty">
          <p>Click <strong>Generate site</strong> to compose a page from the sample listing.</p>
          <p style={{ fontSize: "0.9rem" }}>
            Configure your API key in <code>.env</code> first (see README).
          </p>
        </div>
      )}
      {config && <SiteRenderer config={config} />}
    </>
  );
}
