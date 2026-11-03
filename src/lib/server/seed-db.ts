import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getDb, recordChange } from "./db";
import { hashPassword, encryptCode, hashLookupCode } from "./security";
import { loginHoodies } from "@/content/login-hoodies";

export function seedAmbassadorsIfNeeded(db: any, now = new Date().toISOString()) {
  try {
    const existingCount = db.prepare("SELECT COUNT(*) as c FROM referral_codes").get() as { c: number };
    if (existingCount && existingCount.c > 0) {
      // Ensure AHMED10, AHMED, and 708DDH always exist in promo_codes table as backup
      const insertPromo = db.prepare(`
        INSERT OR IGNORE INTO promo_codes (code, kind, value, active, starts_at, expires_at, max_uses, used, min_subtotal_cents)
        VALUES (?, 'percent', 10, 1, ?, NULL, 10000, 0, 0)
      `);
      insertPromo.run("AHMED10", now);
      insertPromo.run("AHMED", now);
      insertPromo.run("708DDH", now);
      return;
    }

    const ambFile = path.join(process.cwd(), "data", "secure-vault", "ambassadors-data.json");
    let ambList: any[] = [];
    if (fs.existsSync(ambFile)) {
      try {
        ambList = JSON.parse(fs.readFileSync(ambFile, "utf-8"));
      } catch {}
    }

    if (!Array.isArray(ambList) || ambList.length === 0) {
      ambList = [
        {
          id: "amb_ahmed_official",
          displayName: "أحمد",
          fullName: "أحمد عبد الباسط",
          phone: "01000000000",
          email: "ahmed@terrahop.com",
          city: "القاهرة",
          status: "ACTIVE",
          code: "AHMED10",
          aliases: ["AHMED", "708DDH"],
          discountPercent: 10,
          appliesTo: "ALL_PRODUCTS",
          eligibleProductIds: [],
          maxUses: null,
        },
      ];
    }

    const insertAmb = db.prepare(`
      INSERT OR REPLACE INTO ambassadors (
        id, display_name, full_name, phone, email, instagram_handle,
        city, notes, status, suspended_reason, joined_at, created_by_admin,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'seed', ?, ?)
    `);

    const insertRefCode = db.prepare(`
      INSERT OR REPLACE INTO referral_codes (
        id, ambassador_id, code_hash, encrypted_code, discount_percent,
        applies_to, is_active, valid_from, valid_until, max_uses, used_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, NULL, ?, 0, ?)
    `);

    const insertAmbUser = db.prepare(`
      INSERT OR REPLACE INTO ambassador_users (
        id, ambassador_id, email, password_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertAmbProgress = db.prepare(`
      INSERT OR REPLACE INTO ambassador_progress (
        ambassador_id, qualified_count, reversed_count, net_count, pending_count,
        cancelled_count, refunded_count, current_level_id, updated_at
      ) VALUES (?, 0, 0, 0, 0, 0, 0, 'lvl_starter', ?)
    `);

    const insertPromo = db.prepare(`
      INSERT OR REPLACE INTO promo_codes (code, kind, value, active, starts_at, expires_at, max_uses, used, min_subtotal_cents)
      VALUES (?, 'percent', ?, 1, ?, NULL, 10000, 0, 0)
    `);

    const insertDiscountProduct = db.prepare(`
      INSERT OR IGNORE INTO discount_code_products (code_id, product_id)
      VALUES (?, ?)
    `);

    for (const amb of ambList) {
      insertAmb.run(
        amb.id,
        amb.displayName || amb.fullName,
        amb.fullName,
        amb.phone,
        amb.email,
        amb.instagramHandle || null,
        amb.city || "القاهرة",
        amb.notes || "Official Street Ambassador",
        amb.status || "ACTIVE",
        amb.joinedAt || now,
        amb.createdAt || now,
        now
      );

      const codes = [amb.code, ...(Array.isArray(amb.aliases) ? amb.aliases : [])].filter(Boolean);
      for (const rawC of codes) {
        const c = String(rawC).trim().toUpperCase();
        const codeHash = hashLookupCode(c);
        const encrypted = encryptCode(c);
        const refId = `ref_${amb.id}_${c.toLowerCase()}`;

        insertRefCode.run(
          refId,
          amb.id,
          codeHash,
          encrypted,
          amb.discountPercent || 10,
          amb.appliesTo || "ALL_PRODUCTS",
          now,
          amb.maxUses || null,
          now
        );

        if (amb.appliesTo === "SELECTED" && Array.isArray(amb.eligibleProductIds)) {
          for (const pid of amb.eligibleProductIds) {
            insertDiscountProduct.run(refId, pid);
          }
        }

        insertPromo.run(c, amb.discountPercent || 10, now);
      }

      insertAmbUser.run(
        `usr_${amb.id}`,
        amb.id,
        amb.email,
        hashPassword(amb.phone || "ahmed123"),
        now,
        now
      );

      insertAmbProgress.run(amb.id, now);
    }
  } catch (err) {
    console.error("Error seeding ambassadors:", err);
  }
}

export function seedDatabaseIfNeeded(targetDb?: any, force = false): boolean {
  const db = targetDb || getDb();

  const isSeeded = db.prepare("SELECT value FROM meta WHERE key = 'seeded_at'").get() as
    | { value: string }
    | undefined;

  if (isSeeded && !force) {
    seedAmbassadorsIfNeeded(db);
    return false;
  }

  const runSeed = db.transaction(() => {
    const now = new Date().toISOString();

    // 1. Seed Image Slots
    const insertSlot = db.prepare(`
      INSERT OR REPLACE INTO image_slots (key, label_ar, kind, min_items, max_items, aspect, required, revision)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const slots = [
      { key: "hero_carousel", label_ar: "كاروسيل صور الهيدر الرئيسي", kind: "list", min: 0, max: 20, aspect: "4:5", req: 0 },
      { key: "hero_banner", label_ar: "بانر الهيدر العريض (ديسكتوب)", kind: "single", min: 0, max: 1, aspect: "21:9", req: 0 },
      { key: "hero_banner_mobile", label_ar: "بانر الهيدر (موبايل)", kind: "single", min: 0, max: 1, aspect: "4:5", req: 0 },
      { key: "login_showcase", label_ar: "عرض صفحة تسجيل الدخول", kind: "list", min: 0, max: 20, aspect: "4:5", req: 0 },
      { key: "brand_story", label_ar: "صورة قصة البراند (About)", kind: "single", min: 0, max: 1, aspect: "16:9", req: 0 },
      { key: "lookbook", label_ar: "صور اللوك بوك (Lookbook)", kind: "list", min: 0, max: 12, aspect: "3:4", req: 0 },
      { key: "product", label_ar: "صور المنتجات", kind: "list", min: 0, max: 10, aspect: "1:1", req: 0 },
      { key: "logo", label_ar: "شعار المتجر (اللوجو)", kind: "single", min: 1, max: 1, aspect: "auto", req: 1 },
      { key: "favicon", label_ar: "أيقونة المتصفح (Favicon)", kind: "single", min: 0, max: 1, aspect: "1:1", req: 0 },
      { key: "og_image", label_ar: "صورة المشاركة على السوشيال", kind: "single", min: 0, max: 1, aspect: "1.91:1", req: 0 },
    ];

    for (const s of slots) {
      insertSlot.run(s.key, s.label_ar, s.kind, s.min, s.max, s.aspect, s.req);
    }

    // 2. Seed Settings
    const insertSetting = db.prepare(`
      INSERT OR REPLACE INTO settings (group_key, key, value, updated_at, updated_by)
      VALUES (?, ?, ?, ?, 'seed')
    `);

    const defaultSettings: Array<[string, string, unknown]> = [
      [
        "store",
        "info",
        {
          nameAr: "TERRA HOP",
          nameEn: "TERRA HOP",
          currency: "EGP",
          whatsapp: "201285694670",
          phone: "01285694670",
          email: "support@terrahop.com",
          maintenanceMode: false,
          maintenanceMessage: "المتجر في وضع التحديث المؤقت، يرجى العودة قريباً.",
        },
      ],
      [
        "shipping",
        "rules",
        {
          flatRateCents: 6000, // 60 EGP
          freeShippingMinQuantity: 2, // Buy 2 get free shipping
          freeShippingMinAmountCents: 0,
        },
      ],
      [
        "inventory",
        "policy",
        {
          lowStockThreshold: 3,
          reserveMinutes: 30,
        },
      ],
      [
        "carousel",
        "display",
        {
          autoPlay: true,
          intervalMs: 3500,
          emptyBehavior: "hero_banner", // 'hero_banner' | 'hide'
        },
      ],
      [
        "images",
        "rules",
        {
          maxUploadBytes: 10485760, // 10MB
          allowedTypes: ["image/jpeg", "image/png", "image/webp"],
          webpQuality: 85,
        },
      ],
      [
        "site",
        "texts",
        {
          announcement: "اشتري 2 وخد شحن مجاني • فحص وقياس قبل الدفع • دفع عند الاستلام",
          heroTitle: "Drop 01",
          heroSubtitle: "Preorder open",
          heroCtaText: "تسوق الآن",
        },
      ],
      [
        "live",
        "config",
        {
          mode: "sse",
          pollIntervalMs: 20000,
        },
      ],
      [
        "security",
        "config",
        {
          sessionHours: 24,
        },
      ],
    ];

    for (const [group, key, val] of defaultSettings) {
      insertSetting.run(group, key, JSON.stringify(val), now);
    }

    // 3. Seed Site Content (AR & EN)
    const insertContent = db.prepare(`
      INSERT OR REPLACE INTO site_content (key, value_ar, value_en, revision)
      VALUES (?, ?, ?, 1)
    `);

    const contents = [
      {
        key: "hero_title",
        ar: "Drop 01",
        en: "Drop 01",
      },
      {
        key: "hero_subtitle",
        ar: "الحجز المسبق متاح الآن بكميات محدودة",
        en: "Preorder open for limited quantity",
      },
      {
        key: "hero_cta",
        ar: "تسوق الآن",
        en: "Shop Now",
      },
      {
        key: "ticker",
        ar: "اشتري 2 وخد شحن مجاني • فحص وقياس قبل الدفع • الدفع عند الاستلام • جودة قطن مصري 100%",
        en: "Buy 2 Get Free Shipping • Try Before You Pay • Cash On Delivery • 100% Egyptian Cotton",
      },
      {
        key: "story_title",
        ar: "قصة البراند",
        en: "Brand Story",
      },
      {
        key: "story_desc",
        ar: "قصة ملابس ستريت وير مخصصة لشباب مصر بأسلوب بسيط وتصميم أوفرسايز عصري ومريح لكل يوم.",
        en: "Oversized streetwear crafted for Egypt. Small curated drops made for effortless comfort every day.",
      },
    ];

    for (const c of contents) {
      insertContent.run(c.key, c.ar, c.en);
    }

    // 4. Seed Admin User
    const adminEmail = process.env.ADMIN_EMAIL || "admin@terrahop.com";
    const rawPass = process.env.ADMIN_PASSWORD || "admin123";
    const passwordHash = hashPassword(rawPass);

    db.prepare(`
      INSERT OR REPLACE INTO admin_users (id, email, password_hash, must_change_password, created_at)
      VALUES ('admin-root', ?, ?, ?, ?)
    `).run(adminEmail, passwordHash, rawPass === "admin123" ? 1 : 0, now);

    // 5. Seed Promo Codes
    const insertPromo = db.prepare(`
      INSERT OR REPLACE INTO promo_codes (code, kind, value, active, starts_at, expires_at, max_uses, used, min_subtotal_cents)
      VALUES (?, ?, ?, 1, ?, NULL, 1000, 0, 0)
    `);

    const promos = [
      { code: "DROP01", kind: "percent", value: 15 },
      { code: "TERRA10", kind: "percent", value: 10 },
      { code: "VIP20", kind: "percent", value: 20 },
      { code: "WELCOME50", kind: "fixed", value: 5000 }, // 50 EGP off
    ];

    for (const p of promos) {
      insertPromo.run(p.code, p.kind, p.value, now);
    }

    // Helper to insert or get asset
    const insertAsset = db.prepare(`
      INSERT OR IGNORE INTO assets (id, sha256, mime, width, height, bytes, original_name, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'seed')
    `);

    const insertPlacement = db.prepare(`
      INSERT OR REPLACE INTO image_placements (id, slot_key, owner_id, asset_id, position, alt_ar, alt_en, meta, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    // 6. Seed Hero Carousel Placements from loginHoodies
    loginHoodies.forEach((hoodie, idx) => {
      const pseudoSha = crypto.createHash("sha256").update(hoodie.src).digest("hex");
      const existingAsset = db.prepare("SELECT id FROM assets WHERE sha256 = ?").get(pseudoSha) as { id: string } | undefined;
      let assetId: string;
      if (existingAsset) {
        assetId = existingAsset.id;
      } else {
        assetId = `asset-hero-${idx + 1}`;
        insertAsset.run(assetId, pseudoSha, "image/webp", 1080, 1350, 250000, path.basename(hoodie.src), now);
      }

      const meta = JSON.stringify({
        glow: hoodie.glow,
        name: hoodie.name,
        caption: hoodie.caption,
        sourceUrl: hoodie.src,
      });

      // Insert placement into hero_carousel
      insertPlacement.run(
        `plc-hero-${idx + 1}`,
        "hero_carousel",
        null,
        assetId,
        idx + 1,
        hoodie.name,
        hoodie.name,
        meta,
        now
      );

      // Also insert into login_showcase
      insertPlacement.run(
        `plc-login-${idx + 1}`,
        "login_showcase",
        null,
        assetId,
        idx + 1,
        hoodie.name,
        hoodie.name,
        meta,
        now
      );
    });

    // 7. Seed Products from products-data.json
    const productsFile = path.join(process.cwd(), "data", "secure-vault", "products-data.json");
    if (fs.existsSync(productsFile)) {
      try {
        const rawProducts = JSON.parse(fs.readFileSync(productsFile, "utf-8"));
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

        rawProducts.forEach((p: any, pIdx: number) => {
          insertProduct.run(
            p.id,
            p.slug,
            p.name,
            p.name,
            p.description,
            p.description,
            p.category || "hoodie",
            p.priceCents || 115000,
            p.compareAtCents || null,
            p.status || "active",
            p.forceSoldOut ? 1 : 0,
            p.lowStockThreshold || null,
            JSON.stringify(p.details || {}),
            pIdx + 1,
            p.createdAt || now,
            p.updatedAt || now
          );

          // Colors
          if (Array.isArray(p.colors)) {
            p.colors.forEach((c: any, cIdx: number) => {
              insertColor.run(c.id, p.id, c.name, c.hex, cIdx + 1);
            });
          }

          // Variants
          if (Array.isArray(p.variants)) {
            p.variants.forEach((v: any) => {
              insertVariant.run(v.id, p.id, v.colorId, v.size, v.stock ?? 10);
            });
          }

          // Product Images -> slot 'product' with owner_id = p.id
          if (Array.isArray(p.images)) {
            p.images.forEach((img: any, imgIdx: number) => {
              const pSha = crypto.createHash("sha256").update(img.url || `${p.id}-${imgIdx}`).digest("hex");
              const existingAsset = db.prepare("SELECT id FROM assets WHERE sha256 = ?").get(pSha) as { id: string } | undefined;
              let effectiveAssetId: string;
              if (existingAsset) {
                effectiveAssetId = existingAsset.id;
              } else {
                effectiveAssetId = `asset-prod-${p.id}-${imgIdx + 1}`;
                insertAsset.run(effectiveAssetId, pSha, "image/webp", 1000, 1000, 150000, path.basename(img.url || ""), now);
              }

              insertPlacement.run(
                `plc-prod-${p.id}-${imgIdx + 1}`,
                "product",
                p.id,
                effectiveAssetId,
                imgIdx + 1,
                img.alt || p.name,
                img.alt || p.name,
                JSON.stringify({ sourceUrl: img.url }),
                now
              );
            });
          }
        });
      } catch (err) {
        console.error("Failed to parse products-data.json for seed:", err);
      }
    }

    // 8. Seed Street Ambassadors
    seedAmbassadorsIfNeeded(db, now);

    // Mark as seeded
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('seeded_at', ?)").run(now);
    recordChange("media", "seed", null, 1);
    recordChange("products", "seed", null, 1);
    recordChange("settings", "seed", null, 1);
    recordChange("content", "seed", null, 1);
  });

  runSeed();
  return true;
}
