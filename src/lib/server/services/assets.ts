import fs from "fs";
import path from "path";
import crypto from "crypto";
import sharp, { type Metadata } from "sharp";
import { getDb, getBaseStorageDir, recordAudit, recordChange } from "../db";

export interface AssetRecord {
  id: string;
  sha256: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  original_name: string | null;
  created_at: string;
  created_by: string;
}

export function getUploadsDir(): string {
  if (process.env.UPLOADS_DIR) {
    if (!fs.existsSync(process.env.UPLOADS_DIR)) {
      try {
        fs.mkdirSync(process.env.UPLOADS_DIR, { recursive: true });
      } catch {}
    }
    return process.env.UPLOADS_DIR;
  }
  const dir = path.join(getBaseStorageDir(), "uploads");
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
  }
  return dir;
}

export async function processAndSaveAsset(
  buffer: Buffer,
  originalName: string,
  createdBy: string
): Promise<AssetRecord> {
  // 1. Verify image magic bytes via sharp
  let metadata: Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch (err) {
    throw new Error("ملف غير صالح أو صيغة صورة غير مدعومة.");
  }

  if (!metadata.format || !metadata.width || !metadata.height) {
    throw new Error("تعذر قراءة بيانات وأبعاد الصورة.");
  }

  // 2. Compute SHA-256 of original buffer
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const db = getDb();

  // Check if asset already exists
  const existing = db
    .prepare("SELECT * FROM assets WHERE sha256 = ?")
    .get(sha256) as AssetRecord | undefined;

  if (existing) {
    return existing;
  }

  const uploadsDir = getUploadsDir();
  const assetId = `ast_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  // 3. Process image variants with sharp:
  // Full WebP (max width 1600)
  const fullBuffer = await sharp(buffer)
    .rotate() // auto rotate based on EXIF
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 85, effort: 4 })
    .toBuffer();

  const fullMeta = await sharp(fullBuffer).metadata();
  const fullPath = path.join(uploadsDir, `${sha256}.webp`);
  const fullTempPath = path.join(uploadsDir, `${sha256}.tmp`);

  // Atomic write
  fs.writeFileSync(fullTempPath, fullBuffer);
  fs.renameSync(fullTempPath, fullPath);

  // Read-back verification
  const stat = fs.statSync(fullPath);
  if (stat.size !== fullBuffer.length) {
    throw new Error("فشل تأكيد كتابة ملف الصورة على القرص.");
  }

  // Medium WebP (900px width)
  const mdBuffer = await sharp(buffer)
    .rotate()
    .resize({ width: 900, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
  fs.writeFileSync(path.join(uploadsDir, `${sha256}-md.webp`), mdBuffer);

  // Thumbnail WebP (400px width)
  const thumbBuffer = await sharp(buffer)
    .rotate()
    .resize({ width: 400, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  fs.writeFileSync(path.join(uploadsDir, `${sha256}-thumb.webp`), thumbBuffer);

  // 4. Save to database
  db.prepare(`
    INSERT INTO assets (id, sha256, mime, width, height, bytes, original_name, created_at, created_by)
    VALUES (?, ?, 'image/webp', ?, ?, ?, ?, ?, ?)
  `).run(
    assetId,
    sha256,
    fullMeta.width || metadata.width,
    fullMeta.height || metadata.height,
    fullBuffer.length,
    originalName,
    now,
    createdBy
  );

  recordAudit({
    actor: createdBy,
    action: "UPLOAD_ASSET",
    entity: "assets",
    entityId: assetId,
    after: { sha256, width: fullMeta.width, height: fullMeta.height },
  });

  return {
    id: assetId,
    sha256,
    mime: "image/webp",
    width: fullMeta.width || metadata.width,
    height: fullMeta.height || metadata.height,
    bytes: fullBuffer.length,
    original_name: originalName,
    created_at: now,
    created_by: createdBy,
  };
}

/**
 * Removes an uploaded asset only after its final placement has been removed.
 * Seeded or externally hosted assets simply have no local files, which is safe.
 */
export function removeAssetIfUnused(assetId: string): void {
  const db = getDb();
  const remaining = db.prepare("SELECT COUNT(*) AS count FROM image_placements WHERE asset_id = ?").get(assetId) as { count: number };
  if (remaining.count > 0) return;

  const asset = db.prepare("SELECT sha256 FROM assets WHERE id = ?").get(assetId) as { sha256: string } | undefined;
  if (!asset) return;

  db.prepare("DELETE FROM assets WHERE id = ?").run(assetId);
  const uploadsDir = getUploadsDir();
  for (const suffix of [".webp", "-md.webp", "-thumb.webp"]) {
    try {
      fs.unlinkSync(path.join(/* turbopackIgnore: true */ uploadsDir, `${asset.sha256}${suffix}`));
    } catch (error: any) {
      if (error?.code !== "ENOENT") console.error("Failed to delete unused asset file:", error);
    }
  }
}
