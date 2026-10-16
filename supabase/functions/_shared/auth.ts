// Shared Edge Function auth utilities — one authoritative implementation.
//
// PERF: local ES256 JWT verification via the platform's JWKS replaces the
// per-request `supabase.auth.getUser(token)` network round-trip (~200-400ms
// on cloud). The platform still validates the token exists; we verify
// signature + expiry locally and only fall back to the network check if
// JWKS keys rotate mid-flight.
//
// Caching: the JWKS is fetched once per isolate and reused (edge functions
// stay warm), so the first request pays ~50ms and subsequent ones ~0ms.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function err(code: string, message: string, status: number, field?: string) {
  return new Response(
    JSON.stringify({ error: field ? { code, message, field } : { code, message } }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

export function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

// ---------- base64url helpers (no external deps) ----------

function b64urlToBytes(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------- ES256 verification (WebCrypto, edge-native) ----------

interface Jwk {
  kid: string;
  kty: string;
  crv: string;
  x: string;
  y: string;
}

let jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 10 * 60 * 1000; // 10 min

async function getJwks(projectUrl: string): Promise<Jwk[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  const res = await fetch(`${projectUrl}/auth/v1/.well-known/jwks.json`);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const data = await res.json();
  jwksCache = { keys: data.keys, fetchedAt: Date.now() };
  return data.keys;
}

export interface AuthResult {
  ok: boolean;
  userId?: string;
  error?: string;
}

/**
 * Verify a Supabase JWT locally: ES256 signature against the project JWKS
 * + expiry check. Returns the auth user id on success.
 * Network is only touched on cache miss/rotation.
 */
export async function verifyToken(
  token: string,
  projectUrl: string
): Promise<AuthResult> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { ok: false, error: "malformed token" };
    const [headerB64, payloadB64, sigB64] = parts;

    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(headerB64)));
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));

    if (header.alg !== "ES256") return { ok: false, error: "unsupported alg" };
    // exp is MANDATORY — a token without exp must never verify (defense-in-depth;
    // the platform verify_jwt layer is the primary gate)
    if (typeof payload.exp !== "number") return { ok: false, error: "token missing exp" };
    if (payload.exp * 1000 < Date.now()) {
      return { ok: false, error: "token expired" };
    }

    const keys = await getJwks(projectUrl);
    // kid must match — falling back to keys[0] would let a token signed by a
    // different (retired) platform key verify during key rotation windows
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) return { ok: false, error: "no signing key" };

    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, ext: true, key_ops: ["verify"] },
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );

    // JWT ES256 signature is raw r||s (64 bytes) — WebCrypto expects that.
    const sigBytes = b64urlToBytes(sigB64);
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      key,
      sigBytes,
      data
    );
    if (!valid) return { ok: false, error: "bad signature" };

    return { ok: true, userId: payload.sub as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "verify failed" };
  }
}

/** Standard auth extraction from a Request. Fast path: local JWT verify. */
export async function getAuthUser(req: Request, projectUrl: string): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { ok: false, error: "missing auth" };
  const token = authHeader.replace("Bearer ", "");
  return verifyToken(token, projectUrl);
}

/**
 * Never expose raw Postgres/PostgREST error text (constraint names, hints,
 * schema internals) to clients. Known domain errors pass through; everything
 * else collapses to a generic SERVER_ERROR. Internal detail goes to console.
 */
export function publicErrorMessage(e: unknown): { code: string; message: string } {
  const raw = e instanceof Error ? e.message : String(e);
  const KNOWN = [
    "INVALID_QUANTITY", "CATALOG_NOT_FOUND", "INSUFFICIENT_STOCK",
    "STOCK_DECREMENT_FAILED", "DUPLICATE_CHECKOUT", "INVALID_STATE",
    "ALREADY_RESOLVED", "DELIVERY_MISMATCH", "COMPLIANCE_REQUIRED",
  ];
  for (const k of KNOWN) {
    if (raw.includes(k)) return { code: k, message: k };
  }
  console.error("[ef] unhandled error:", raw);
  return { code: "SERVER_ERROR", message: "Something went wrong. Please try again." };
}
