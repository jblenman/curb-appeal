// Best-effort, infra-free abuse/cost guards for the public persona endpoint.
//
// IMPORTANT: this state is in-memory and per-instance. On Vercel a warm function
// instance keeps it across requests, but it resets on cold starts and is not
// shared across concurrent instances. That's an acceptable best-effort layer for
// a demo; the real backstop is an account-level spend limit set in the Anthropic
// console. Cross-instance limits would need a shared store (e.g. Vercel KV /
// Upstash) — noted as a future upgrade.
import type { SiteConfig } from "../src/types.js";

const MAX = Number(process.env.RATE_LIMIT_MAX) || 10;
const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000; // 1 hour
const CACHE_MAX = 50;

interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();
// Insertion-ordered Map used as a simple LRU.
const cache = new Map<string, SiteConfig>();

type Headers = Record<string, string | string[] | undefined>;

/** Resolve the client IP behind Vercel's proxy (x-forwarded-for / x-real-ip). */
export function clientIp(headers: Headers, fallback?: string): string {
  const xff = headers["x-forwarded-for"];
  const first = Array.isArray(xff) ? xff[0] : xff;
  if (first) return first.split(",")[0].trim();
  const xr = headers["x-real-ip"];
  if (typeof xr === "string" && xr) return xr;
  return fallback || "unknown";
}

export interface RateResult {
  ok: boolean;
  retryAfterSec?: number;
  remaining?: number;
}

/** Fixed-window per-IP limit. Only call this for requests that will spend tokens. */
export function checkRateLimit(ip: string): RateResult {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(ip, b);
  }
  if (b.count >= MAX) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  b.count++;
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
  }
  return { ok: true, remaining: MAX - b.count };
}

function personaKey(persona: string): string {
  return persona.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Cache hits cost nothing and bypass the rate limit. */
export function getCached(persona: string): SiteConfig | undefined {
  const k = personaKey(persona);
  const hit = cache.get(k);
  if (hit) {
    cache.delete(k);
    cache.set(k, hit); // move to most-recent
  }
  return hit;
}

export function setCached(persona: string, site: SiteConfig): void {
  const k = personaKey(persona);
  cache.delete(k);
  cache.set(k, site);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}
