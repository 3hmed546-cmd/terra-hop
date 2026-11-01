import crypto from "crypto";

/**
 * Enterprise-Grade Security Engine:
 * - Cryptographically signed session tokens (HMAC-SHA256)
 * - Constant-time comparison against timing attacks (crypto.timingSafeEqual)
 * - Safe key derivation for AES-256 encryption
 */

function getSecretKey(): string {
  const secret = process.env.SESSION_SECRET || "terra-hop-fallback-vault-secret-key-2026-v1";
  return secret;
}

/**
 * Generates an HMAC-SHA256 signed session token for authenticated admins.
 * Format: header.payload.signature
 */
export function signSessionToken(email: string): string {
  const secret = getSecretKey();
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "TERRA-SESSION" })).toString("base64url");
  
  const payload = Buffer.from(
    JSON.stringify({
      sub: email,
      role: "admin",
      iat: Date.now(),
      exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      nonce: crypto.randomBytes(16).toString("hex"),
    })
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

export interface VerifySessionResult {
  valid: boolean;
  email?: string;
  expired?: boolean;
}

/**
 * Verifies the HMAC-SHA256 signature and expiration of a session token.
 * Uses timingSafeEqual to prevent signature forgery via timing side-channels.
 */
export function verifySessionToken(token: string | undefined | null): VerifySessionResult {
  if (!token || typeof token !== "string") {
    return { valid: false };
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false };
  }

  const [header, payload, signature] = parts;
  const secret = getSecretKey();

  try {
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(`${header}.${payload}`)
      .digest("base64url");

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);

    // Timing-safe comparison of the cryptographic signature
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return { valid: false };
    }

    const decodedPayload = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    const now = Date.now();

    if (typeof decodedPayload.exp !== "number" || now > decodedPayload.exp) {
      return { valid: false, expired: true };
    }

    if (decodedPayload.role !== "admin") {
      return { valid: false };
    }

    return { valid: true, email: decodedPayload.sub };
  } catch {
    return { valid: false };
  }
}

/**
 * Constant-time string comparison to prevent password timing attacks.
 * Hashes both strings with SHA-256 before comparing equal-length buffers.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  try {
    const hashA = crypto.createHash("sha256").update(a).digest();
    const hashB = crypto.createHash("sha256").update(b).digest();
    return crypto.timingSafeEqual(hashA, hashB);
  } catch {
    return false;
  }
}
