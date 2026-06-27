import { HttpError } from "./errors";

/**
 * Verify a Firebase Authentication ID token entirely at the edge, with no
 * Admin SDK. We fetch Google's public signing keys (JWK form), verify the
 * RS256 signature with the Web Crypto API, and check the standard Firebase
 * claims (audience = project id, issuer, expiry). Returns the user's uid.
 *
 * This is what lets a public proxy stay safe: only ID tokens minted for THIS
 * Firebase project (i.e. your signed-in app users) are accepted.
 */

/** Google's Secure Token Service public keys, in JWK form. */
const JWK_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

interface Jwk {
  kid: string;
  n: string;
  e: string;
  kty: string;
}

interface TokenPayload {
  aud?: unknown;
  iss?: unknown;
  sub?: unknown;
  exp?: unknown;
  iat?: unknown;
}

// Cache the imported keys across requests on a warm isolate, honoring the
// Cache-Control max-age Google returns (keys rotate roughly daily).
let keyCache: { keys: Map<string, CryptoKey>; expiresAt: number } | null = null;

function base64UrlToBytes(b64url: string): Uint8Array {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad) b64 += "=".repeat(4 - pad);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function decodeJsonSegment(segment: string): Record<string, unknown> {
  const json = new TextDecoder().decode(base64UrlToBytes(segment));
  return JSON.parse(json) as Record<string, unknown>;
}

async function getSigningKeys(): Promise<Map<string, CryptoKey>> {
  const now = Date.now();
  if (keyCache && keyCache.expiresAt > now) return keyCache.keys;

  const res = await fetch(JWK_URL);
  if (!res.ok) throw new HttpError(503, "Could not fetch auth signing keys.");
  const body = (await res.json()) as { keys?: Jwk[] };

  const keys = new Map<string, CryptoKey>();
  for (const jwk of body.keys ?? []) {
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    keys.set(jwk.kid, key);
  }

  const maxAge = /max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "");
  const ttlMs = (maxAge ? parseInt(maxAge[1], 10) : 3600) * 1000;
  keyCache = { keys, expiresAt: now + ttlMs };
  return keys;
}

/** Verify the token and return the Firebase uid, or throw an HttpError(401). */
export async function verifyFirebaseToken(
  token: string,
  projectId: string,
): Promise<string> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new HttpError(401, "Malformed token.");
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: Record<string, unknown>;
  let payload: TokenPayload;
  try {
    header = decodeJsonSegment(headerB64);
    payload = decodeJsonSegment(payloadB64) as TokenPayload;
  } catch {
    throw new HttpError(401, "Malformed token.");
  }

  const kid = header.kid;
  if (header.alg !== "RS256" || typeof kid !== "string") {
    throw new HttpError(401, "Unsupported token.");
  }

  const keys = await getSigningKeys();
  const key = keys.get(kid);
  if (!key) throw new HttpError(401, "Unknown token signing key.");

  const signed = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlToBytes(signatureB64);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature,
    signed,
  );
  if (!valid) throw new HttpError(401, "Invalid token signature.");

  const now = Math.floor(Date.now() / 1000);
  const expectedIss = `https://securetoken.google.com/${projectId}`;
  if (typeof payload.exp !== "number" || payload.exp <= now) {
    throw new HttpError(401, "Token expired.");
  }
  if (typeof payload.iat !== "number" || payload.iat > now + 300) {
    throw new HttpError(401, "Token issued in the future.");
  }
  if (payload.aud !== projectId) throw new HttpError(401, "Token audience mismatch.");
  if (payload.iss !== expectedIss) throw new HttpError(401, "Token issuer mismatch.");
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new HttpError(401, "Token missing subject.");
  }

  return payload.sub;
}
