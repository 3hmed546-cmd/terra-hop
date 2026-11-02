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
export function signSessionToken(email: string, sessionId?: string): string {
  const secret = getSecretKey();
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "TERRA-SESSION" })).toString("base64url");
  const sid = sessionId || crypto.randomUUID();

  const payload = Buffer.from(
    JSON.stringify({
      sub: email,
      sid,
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
  sessionId?: string;
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

    return { valid: true, email: decodedPayload.sub, sessionId: decodedPayload.sid };
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

/**
 * Scrypt-based password hashing (secure against GPU/ASIC brute forcing)
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password.normalize("NFKC"), salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
  });
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash in constant time
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(":");
    if (parts.length !== 2) return false;
    const [salt, expectedKeyHex] = parts;
    const derivedKey = crypto.scryptSync(password.normalize("NFKC"), salt, 64, {
      N: 16384,
      r: 8,
      p: 1,
    });
    const keyBuf = derivedKey;
    const expectedBuf = Buffer.from(expectedKeyHex, "hex");
    if (keyBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(keyBuf, expectedBuf);
  } catch {
    return false;
  }
}

/**
 * Generate CSRF token cryptographically bound to the session
 */
export function generateCsrfToken(sessionId: string): string {
  const secret = getSecretKey();
  return crypto.createHmac("sha256", secret).update(`csrf:${sessionId}`).digest("hex");
}

/**
 * Verify CSRF token
 */
export function verifyCsrfToken(sessionId: string, token: string): boolean {
  if (!sessionId || !token) return false;
  const expected = generateCsrfToken(sessionId);
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Encrypted & Hashed Discount / Referral Codes & Vouchers
// "الكبونات بتاعة الخصم تكون مشفره لعدم قرائتها"
// ---------------------------------------------------------------------------

function getVoucherCipherKey(): Buffer {
  const secret = getSecretKey();
  return crypto.createHash("sha256").update(`${secret}:voucher_aes256_key`).digest();
}

/**
 * Hash lookup for referral & voucher codes.
 * Enables O(1) indexed database lookups without storing plaintext codes.
 */
export function hashLookupCode(rawCode: string): string {
  const normalized = (rawCode || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return crypto.createHash("sha256").update(`TH_VOUCHER_SALT_2026:${normalized}`).digest("hex");
}

/**
 * Encrypt a voucher or referral code with AES-256-GCM.
 * Stored in database so no plaintext code is ever exposed or readable directly.
 */
export function encryptCode(rawCode: string): string {
  const normalized = (rawCode || "").trim().toUpperCase();
  const key = getVoucherCipherKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(normalized, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt an AES-256-GCM encrypted voucher or referral code.
 */
export function decryptCode(payload: string): string {
  if (!payload || !payload.includes(":")) return "";
  try {
    const [ivHex, tagHex, dataHex] = payload.split(":");
    if (!ivHex || !tagHex || !dataHex) return "";
    const key = getVoucherCipherKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(tagHex, "hex");
    const data = Buffer.from(dataHex, "hex");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString("utf-8");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Ambassador Session Management (Separate Auth Realm)
// ---------------------------------------------------------------------------

function getAmbassadorSecretKey(): string {
  return process.env.AMBASSADOR_SESSION_SECRET || `${getSecretKey()}:ambassador_realm`;
}

export function signAmbassadorSessionToken(
  ambassadorId: string,
  email: string,
  sessionId?: string
): string {
  const secret = getAmbassadorSecretKey();
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "TERRA-AMBASSADOR" })).toString("base64url");
  const sid = sessionId || crypto.randomUUID();

  const payload = Buffer.from(
    JSON.stringify({
      sub: email,
      ambId: ambassadorId,
      sid,
      role: "ambassador",
      aud: "terra_ambassador",
      iat: Date.now(),
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
      nonce: crypto.randomBytes(16).toString("hex"),
    })
  ).toString("base64url");

  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");

  return `${header}.${payload}.${signature}`;
}

export interface VerifyAmbassadorResult {
  valid: boolean;
  ambassadorId?: string;
  email?: string;
  sessionId?: string;
  expired?: boolean;
}

export function verifyAmbassadorSessionToken(
  token: string | undefined | null
): VerifyAmbassadorResult {
  if (!token || typeof token !== "string") {
    return { valid: false };
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false };
  }

  const [header, payload, signature] = parts;
  const secret = getAmbassadorSecretKey();

  try {
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(`${header}.${payload}`)
      .digest("base64url");

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return { valid: false };
    }

    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    const now = Date.now();

    if (typeof decoded.exp !== "number" || now > decoded.exp) {
      return { valid: false, expired: true };
    }

    if (decoded.role !== "ambassador" || decoded.aud !== "terra_ambassador") {
      return { valid: false };
    }

    return {
      valid: true,
      ambassadorId: decoded.ambId,
      email: decoded.sub,
      sessionId: decoded.sid,
    };
  } catch {
    return { valid: false };
  }
}

