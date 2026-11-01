import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import os from "os";

/**
 * Encrypted Server-Side Data Vault (AES-256-GCM)
 * Provides military-grade encryption at rest for customer Personally Identifiable Information (PII)
 * and order records. Works seamlessly on both cPanel/VPS (persistent local disk) and Vercel/Serverless (/tmp fallback).
 */

export interface VaultOrderCustomer {
  name: string;
  phone: string;
  email: string;
  city: string;
  address: string;
}

export interface VaultOrderItem {
  productSlug: string;
  productName: string;
  size: string;
  qty: number;
  priceCents: number;
}

export interface VaultOrder {
  id: string;
  number: string;
  source: string;
  status: "AWAITING_APPROVAL" | "SOLD" | "CANCELLED" | "PENDING_EMAIL";
  customer: VaultOrderCustomer;
  notes?: string;
  items: VaultOrderItem[];
  subtotalCents: number;
  shippingCents: number;
  discountCents?: number;
  totalCents: number;
  createdAt: string;
  soldAt?: string | null;
}

function getVaultDir(): string {
  // In serverless environments (Vercel / AWS Lambda), the root filesystem is read-only.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), "terra-secure-vault");
  }
  return path.join(process.cwd(), "data", "secure-vault");
}

function getVaultFile(): string {
  return path.join(getVaultDir(), "orders.vault.enc");
}

// Derive 32-byte (256-bit) encryption key from SESSION_SECRET
function getVaultKey(): Buffer {
  const secret = process.env.SESSION_SECRET || "terra-hop-vault-secure-key-2026-v1";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts data using AES-256-GCM with a random IV and integrity AuthTag
 */
function encryptData(plaintext: string): Buffer {
  const key = getVaultKey();
  const iv = crypto.randomBytes(12); // Recommended 12 bytes for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 bytes

  // Format: [12-byte IV] + [16-byte AuthTag] + [Ciphertext]
  return Buffer.concat([iv, authTag, ciphertext]);
}

/**
 * Decrypts AES-256-GCM data and verifies cryptographic integrity
 */
function decryptData(encryptedBuffer: Buffer): string {
  if (encryptedBuffer.length < 28) {
    throw new Error("Invalid or corrupted vault data");
  }

  const key = getVaultKey();
  const iv = encryptedBuffer.subarray(0, 12);
  const authTag = encryptedBuffer.subarray(12, 28);
  const ciphertext = encryptedBuffer.subarray(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Ensures the secure vault directory exists on disk
 */
async function ensureVaultDir(): Promise<void> {
  const dir = getVaultDir();
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // If permission or read-only error on current directory, fallback to os.tmpdir()
    try {
      await fs.mkdir(path.join(os.tmpdir(), "terra-secure-vault"), { recursive: true });
    } catch {
      // Best-effort
    }
  }
}

/**
 * Reads and decrypts all orders from the server vault
 */
export async function getOrdersFromVault(): Promise<VaultOrder[]> {
  await ensureVaultDir();
  const file = getVaultFile();
  try {
    const raw = await fs.readFile(file);
    if (!raw || raw.length === 0) return [];
    const decryptedJson = decryptData(raw);
    const parsed = JSON.parse(decryptedJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err: unknown) {
    // If file doesn't exist yet, return empty array
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    // Corrupted or tampered data - fail closed for security
    console.error("[Vault Security Warning] Could not decrypt orders vault:", err);
    return [];
  }
}

/**
 * Encrypts and appends a new customer order into the server vault
 */
export async function saveOrderToVault(order: VaultOrder): Promise<void> {
  await ensureVaultDir();
  const file = getVaultFile();
  const existing = await getOrdersFromVault();
  
  // Prepend new order
  const updated = [order, ...existing.filter((o) => o.id !== order.id)];
  
  const encrypted = encryptData(JSON.stringify(updated));
  // Write atomically using temporary file to prevent partial writes
  const tempFile = `${file}.${Date.now()}.tmp`;
  await fs.writeFile(tempFile, encrypted);
  await fs.rename(tempFile, file);
}

/**
 * Updates order status in the encrypted vault
 */
export async function updateOrderStatusInVault(
  orderId: string,
  status: VaultOrder["status"]
): Promise<boolean> {
  await ensureVaultDir();
  const file = getVaultFile();
  const existing = await getOrdersFromVault();
  const index = existing.findIndex((o) => o.id === orderId);
  
  if (index === -1) return false;

  existing[index].status = status;
  if (status === "SOLD") {
    existing[index].soldAt = new Date().toISOString();
  }

  const encrypted = encryptData(JSON.stringify(existing));
  const tempFile = `${file}.${Date.now()}.tmp`;
  await fs.writeFile(tempFile, encrypted);
  await fs.rename(tempFile, file);
  return true;
}
