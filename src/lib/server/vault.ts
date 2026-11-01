import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

/**
 * Encrypted Server-Side Data Vault (AES-256-GCM)
 * Provides military-grade encryption at rest for customer Personally Identifiable Information (PII)
 * and order records. Stored in an isolated directory (data/secure-vault/) away from public web roots.
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

const VAULT_DIR = path.join(process.cwd(), "data", "secure-vault");
const VAULT_FILE = path.join(VAULT_DIR, "orders.vault.enc");

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
  try {
    await fs.mkdir(VAULT_DIR, { recursive: true });
  } catch {
    // Already exists
  }
}

/**
 * Reads and decrypts all orders from the server vault
 */
export async function getOrdersFromVault(): Promise<VaultOrder[]> {
  await ensureVaultDir();
  try {
    const raw = await fs.readFile(VAULT_FILE);
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
  const existing = await getOrdersFromVault();
  
  // Prepend new order
  const updated = [order, ...existing.filter((o) => o.id !== order.id)];
  
  const encrypted = encryptData(JSON.stringify(updated));
  // Write atomically using temporary file to prevent partial writes
  const tempFile = `${VAULT_FILE}.${Date.now()}.tmp`;
  await fs.writeFile(tempFile, encrypted);
  await fs.rename(tempFile, VAULT_FILE);
}

/**
 * Updates order status in the encrypted vault
 */
export async function updateOrderStatusInVault(
  orderId: string,
  status: VaultOrder["status"]
): Promise<boolean> {
  await ensureVaultDir();
  const existing = await getOrdersFromVault();
  const index = existing.findIndex((o) => o.id === orderId);
  
  if (index === -1) return false;

  existing[index].status = status;
  if (status === "SOLD") {
    existing[index].soldAt = new Date().toISOString();
  }

  const encrypted = encryptData(JSON.stringify(existing));
  const tempFile = `${VAULT_FILE}.${Date.now()}.tmp`;
  await fs.writeFile(tempFile, encrypted);
  await fs.rename(tempFile, VAULT_FILE);
  return true;
}
