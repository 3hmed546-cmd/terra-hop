const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// Let's locate the database
let dbPath = path.join(process.cwd(), 'storage', 'terra.db');
const tmpDbPath = path.join(os.tmpdir(), 'terra-storage', 'terra.db');

const targetPaths = [dbPath, tmpDbPath].filter(p => fs.existsSync(p));
console.log('Found databases at:', targetPaths);

if (targetPaths.length === 0) {
  fs.mkdirSync(path.join(process.cwd(), 'storage'), { recursive: true });
  targetPaths.push(dbPath);
}

const rawProducts = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'secure-vault', 'products-data.json'), 'utf8'));

for (const p of targetPaths) {
  console.log('Updating database at:', p);
  const db = new Database(p);
  const now = new Date().toISOString();

  // Create schema if needed
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name_ar TEXT NOT NULL,
      name_en TEXT NOT NULL,
      description_ar TEXT,
      description_en TEXT,
      category TEXT NOT NULL DEFAULT 'hoodie',
      price_cents INTEGER NOT NULL,
      compare_at_cents INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      force_sold_out INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER,
      details TEXT,
      position INTEGER NOT NULL DEFAULT 1,
      revision INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS product_colors (
      id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      hex TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (product_id, id)
    );
    CREATE TABLE IF NOT EXISTS variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      color_id TEXT NOT NULL,
      size TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      reserved INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      sha256 TEXT UNIQUE NOT NULL,
      mime TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      bytes INTEGER NOT NULL,
      original_name TEXT,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL DEFAULT 'system'
    );
    CREATE TABLE IF NOT EXISTS image_placements (
      id TEXT PRIMARY KEY,
      slot_key TEXT NOT NULL,
      owner_id TEXT,
      asset_id TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 1,
      alt_ar TEXT,
      alt_en TEXT,
      meta TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
  `);

  const tx = db.transaction(() => {
    // 1. Delete old products and product placements
    db.prepare("DELETE FROM variants").run();
    db.prepare("DELETE FROM product_colors").run();
    db.prepare("DELETE FROM products").run();
    db.prepare("DELETE FROM image_placements WHERE slot_key = 'product'").run();

    // 2. Prepare insert statements
    const insertProduct = db.prepare(`
      INSERT OR REPLACE INTO products (
        id, slug, name_ar, name_en, description_ar, description_en,
        category, price_cents, compare_at_cents, status, force_sold_out,
        low_stock_threshold, details, position, revision, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    const insertColor = db.prepare(`
      INSERT OR REPLACE INTO product_colors (id, product_id, name, hex, position)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertVariant = db.prepare(`
      INSERT OR REPLACE INTO variants (id, product_id, color_id, size, stock)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertAsset = db.prepare(`
      INSERT OR IGNORE INTO assets (id, sha256, mime, width, height, bytes, original_name, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'seed')
    `);

    const insertPlacement = db.prepare(`
      INSERT OR REPLACE INTO image_placements (id, slot_key, owner_id, asset_id, position, alt_ar, alt_en, meta, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    // 3. Insert each product
    rawProducts.forEach((prod, pIdx) => {
      insertProduct.run(
        prod.id,
        prod.slug,
        prod.name,
        prod.name,
        prod.description,
        prod.description,
        prod.category || 'hoodie',
        prod.priceCents || 125000,
        prod.compareAtCents || null,
        prod.status || 'active',
        prod.forceSoldOut ? 1 : 0,
        prod.lowStockThreshold || 3,
        JSON.stringify(prod.details || {}),
        pIdx + 1,
        now,
        now
      );

      // Colors
      if (Array.isArray(prod.colors)) {
        prod.colors.forEach((c, cIdx) => {
          insertColor.run(c.id, prod.id, c.name, c.hex, cIdx + 1);
        });
      }

      // Variants
      if (Array.isArray(prod.variants)) {
        prod.variants.forEach((v) => {
          insertVariant.run(v.id, prod.id, v.colorId, v.size, v.stock || 15);
        });
      }

      // Product Images
      if (Array.isArray(prod.images)) {
        prod.images.forEach((img, imgIdx) => {
          const pSha = crypto.createHash('sha256').update(img.url || `${prod.id}-${imgIdx}`).digest('hex');
          const existingAsset = db.prepare('SELECT id FROM assets WHERE sha256 = ?').get(pSha);
          let assetId = existingAsset ? existingAsset.id : `asset-prod-${prod.id}-${imgIdx + 1}`;
          if (!existingAsset) {
            insertAsset.run(assetId, pSha, 'image/jpeg', 1080, 1350, 200000, path.basename(img.url || ''), now);
          }

          insertPlacement.run(
            `plc-prod-${prod.id}-${imgIdx + 1}`,
            'product',
            prod.id,
            assetId,
            imgIdx + 1,
            img.alt || prod.name,
            img.alt || prod.name,
            JSON.stringify({ sourceUrl: img.url }),
            now
          );
        });
      }
    });

    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('seeded_at', ?)").run(now);
  });

  tx();
  console.log('Successfully updated database at:', p);

  const count = db.prepare("SELECT count(*) as c FROM products").get();
  console.log('New product count in db:', count.c);
}
