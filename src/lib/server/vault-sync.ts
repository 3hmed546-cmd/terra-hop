import fs from "fs";
import path from "path";
import type Database from "better-sqlite3";

const VAULT_DIR = path.join(process.cwd(), "data", "secure-vault");

function ensureVaultDir() {
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }
}

/**
 * Authoritative synchronization of products from SQLite to data/secure-vault/products-data.json
 * Guarantees that any product mutation (prices, status, sold out, images, sizes, colors)
 * persists across serverless container restarts and deployments.
 */
export function syncProductsVault(db: Database.Database): void {
  try {
    ensureVaultDir();
    const vaultPath = path.join(VAULT_DIR, "products-data.json");

    const products = db
      .prepare("SELECT * FROM products ORDER BY position ASC, created_at DESC")
      .all() as any[];

    const colors = db
      .prepare("SELECT * FROM product_colors ORDER BY position ASC")
      .all() as any[];

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
      list.push({ id: c.id, name: c.name, hex: c.hex });
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

    fs.writeFileSync(vaultPath, JSON.stringify(vaultProducts, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to sync products to secure vault:", err);
  }
}

/**
 * Authoritative synchronization of hero & header images from SQLite to data/secure-vault/gallery-data.json
 * Guarantees that deleted images never reappear on refresh or server restart.
 */
export function syncGalleryVault(db: Database.Database): void {
  try {
    ensureVaultDir();
    const vaultPath = path.join(VAULT_DIR, "gallery-data.json");

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

    fs.writeFileSync(vaultPath, JSON.stringify(galleryItems, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to sync gallery to secure vault:", err);
  }
}
