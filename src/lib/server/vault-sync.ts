import fs from "fs";
import path from "path";
import type Database from "better-sqlite3";
import { getBaseStorageDir } from "./db";

const REPO_VAULT_DIR = path.join(process.cwd(), "data", "secure-vault");

function getStorageVaultDir(): string {
  return path.join(getBaseStorageDir(), "vault");
}

function writeToAllVaultDirs(fileName: string, content: string) {
  // 1. Storage directory (always writable, e.g. /tmp/terra-storage/vault on Vercel)
  try {
    const storageVault = getStorageVaultDir();
    if (!fs.existsSync(storageVault)) {
      fs.mkdirSync(storageVault, { recursive: true });
    }
    fs.writeFileSync(path.join(storageVault, fileName), content, "utf-8");
  } catch (err) {
    console.error(`Failed to write ${fileName} to storage vault:`, err);
  }

  // 2. Repo directory (writable in local dev / persistent server)
  try {
    if (!fs.existsSync(REPO_VAULT_DIR)) {
      fs.mkdirSync(REPO_VAULT_DIR, { recursive: true });
    }
    fs.writeFileSync(path.join(REPO_VAULT_DIR, fileName), content, "utf-8");
  } catch {
    // Expected on read-only serverless filesystems (e.g. AWS Lambda / Vercel production container)
  }
}

/**
 * Reads vault file checking writable storage first, then falling back to repo bundled copy
 */
export function readVaultFile<T = any>(fileName: string): T | null {
  // Check storage vault first
  try {
    const storagePath = path.join(getStorageVaultDir(), fileName);
    if (fs.existsSync(storagePath)) {
      const data = JSON.parse(fs.readFileSync(storagePath, "utf-8"));
      if (data !== undefined && data !== null) return data;
    }
  } catch {}

  // Fallback to repo bundled vault
  try {
    const repoPath = path.join(REPO_VAULT_DIR, fileName);
    if (fs.existsSync(repoPath)) {
      const data = JSON.parse(fs.readFileSync(repoPath, "utf-8"));
      if (data !== undefined && data !== null) return data;
    }
  } catch {}

  return null;
}

/**
 * Authoritative synchronization of products from SQLite to products-data.json
 * Guarantees that any product mutation (prices, status, sold out, images, sizes, colors)
 * persists across serverless container restarts and deployments.
 */
export function syncProductsVault(db: Database.Database): void {
  try {
    const products = db
      .prepare("SELECT * FROM products ORDER BY position ASC, created_at DESC")
      .all() as any[];

    // Check if image_url column exists in product_colors
    let colors: any[] = [];
    try {
      colors = db
        .prepare("SELECT id, product_id, name, hex, position, image_url FROM product_colors ORDER BY position ASC")
        .all() as any[];
    } catch {
      colors = db
        .prepare("SELECT id, product_id, name, hex, position FROM product_colors ORDER BY position ASC")
        .all() as any[];
    }

    const variants = db
      .prepare("SELECT * FROM variants")
      .all() as any[];

    const placements = db
      .prepare(`
        SELECT p.*, a.sha256
        FROM image_placements p
        JOIN assets a ON p.asset_id = a.id
        WHERE p.slot_key = 'product'
        ORDER BY p.position ASC
      `)
      .all() as any[];

    const colorsByProd = new Map<string, any[]>();
    for (const c of colors) {
      const list = colorsByProd.get(c.product_id) || [];
      list.push({ id: c.id, name: c.name, hex: c.hex, image: c.image_url || undefined });
      colorsByProd.set(c.product_id, list);
    }

    const variantsByProd = new Map<string, any[]>();
    for (const v of variants) {
      const list = variantsByProd.get(v.product_id) || [];
      list.push({ id: v.id, colorId: v.color_id, size: v.size, stock: v.stock });
      variantsByProd.set(v.product_id, list);
    }

    const imagesByProd = new Map<string, any[]>();
    for (const p of placements) {
      if (!p.owner_id) continue;
      const list = imagesByProd.get(p.owner_id) || [];
      let meta: any = {};
      try {
        meta = JSON.parse(p.meta || "{}");
      } catch {}
      const sourceUrl = meta.sourceUrl;
      list.push({
        id: p.id,
        url: sourceUrl || `/media/${p.sha256}.webp`,
        alt: p.alt_ar || "",
        position: p.position,
      });
      imagesByProd.set(p.owner_id, list);
    }

    const vaultProducts = products.map((p) => {
      let details = {};
      try {
        details = JSON.parse(p.details || "{}");
      } catch {}

      const prodVariants = variantsByProd.get(p.id) || [];
      const prodColors = colorsByProd.get(p.id) || [];
      const prodImages = imagesByProd.get(p.id) || [];
      const sizes = Array.from(new Set(prodVariants.map((v) => v.size).filter(Boolean)));

      return {
        id: p.id,
        slug: p.slug,
        name: p.name_ar,
        nameAr: p.name_ar,
        nameEn: p.name_en,
        description: p.description_ar,
        category: p.category,
        priceCents: p.price_cents,
        compareAtCents: p.compare_at_cents,
        status: p.status,
        forceSoldOut: p.force_sold_out === 1,
        lowStockThreshold: p.low_stock_threshold,
        details,
        colors: prodColors,
        sizes,
        variants: prodVariants,
        images: prodImages,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      };
    });

    writeToAllVaultDirs("products-data.json", JSON.stringify(vaultProducts, null, 2));
  } catch (err) {
    console.error("Failed to sync products to secure vault:", err);
  }
}

/**
 * Authoritative synchronization of hero & header images from SQLite to gallery-data.json
 * Guarantees that deleted images never reappear on refresh or server restart.
 */
export function syncGalleryVault(db: Database.Database): void {
  try {
    const placements = db
      .prepare(`
        SELECT p.*, a.sha256
        FROM image_placements p
        JOIN assets a ON p.asset_id = a.id
        WHERE p.slot_key = 'hero_carousel' AND p.active = 1
        ORDER BY p.position ASC
      `)
      .all() as any[];

    const galleryItems = placements.map((p) => {
      let meta: any = {};
      try {
        meta = JSON.parse(p.meta || "{}");
      } catch {}

      const sourceUrl = meta.sourceUrl;
      const url = sourceUrl || `/media/${p.sha256}.webp`;

      return {
        id: p.id,
        title: p.alt_ar || meta.name || "صورة هيدر",
        src: url,
        category: "header",
        tag: meta.tag || "هيدر كاروسيل",
        addedAt: (p.created_at || "").split("T")[0] || new Date().toISOString().split("T")[0],
        meta,
      };
    });

    writeToAllVaultDirs("gallery-data.json", JSON.stringify(galleryItems, null, 2));
  } catch (err) {
    console.error("Failed to sync gallery to secure vault:", err);
  }
}
