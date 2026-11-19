import { getDb } from "./db";
import type { Product } from "@/content/home";

export function getCatalogProducts(): Product[] {
  try {
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT * FROM products WHERE status != 'archived' AND status != 'draft' ORDER BY position ASC, created_at DESC"
      )
      .all() as any[];

    if (!Array.isArray(rows) || rows.length === 0) {
      return [];
    }

    let placements: any[] = [];
    try {
      placements = db
        .prepare(
          "SELECT p.*, a.sha256 FROM image_placements p JOIN assets a ON p.asset_id = a.id WHERE p.slot_key = 'product' AND p.active = 1 ORDER BY p.position ASC"
        )
        .all();
    } catch {}

    const imagesByProd = new Map<string, any[]>();
    for (const p of placements) {
      if (!p.owner_id) continue;
      const list = imagesByProd.get(p.owner_id) || [];
      let meta: any = {};
      try {
        meta = JSON.parse(p.meta || "{}");
      } catch {}
      list.push(meta.sourceUrl || `/media/${p.sha256}.webp`);
      imagesByProd.set(p.owner_id, list);
    }

    let colorsByProd = new Map<string, any[]>();
    try {
      const colors = db
        .prepare("SELECT id, product_id, name, hex, position FROM product_colors ORDER BY position ASC")
        .all() as any[];
      for (const c of colors) {
        const list = colorsByProd.get(c.product_id) || [];
        list.push({ id: c.id, name: c.name, hex: c.hex });
        colorsByProd.set(c.product_id, list);
      }
    } catch {}

    let variantsByProd = new Map<string, any[]>();
    try {
      const variants = db.prepare("SELECT * FROM variants").all() as any[];
      for (const v of variants) {
        const list = variantsByProd.get(v.product_id) || [];
        list.push(v);
        variantsByProd.set(v.product_id, list);
      }
    } catch {}

    return rows.map((p: any) => {
      const imgs = imagesByProd.get(p.id) || [];
      const prodVariants = variantsByProd.get(p.id) || [];
      const isSoldOut =
        p.force_sold_out === 1 ||
        p.status === "sold_out" ||
        (prodVariants.length > 0 && prodVariants.every((v) => (v.stock ?? 0) <= 0));

      const sizes =
        prodVariants.length > 0
          ? Array.from(new Set(prodVariants.map((v: any) => v.size).filter(Boolean)))
          : ["S", "M", "L", "XL", "XXL"];

      return {
        id: p.id,
        slug: p.slug,
        name: p.name_ar || p.name_en || p.slug,
        category:
          p.category === "tshirt" || p.category === "T-shirts"
            ? "T-shirts"
            : p.category === "pants" || p.category === "Pants"
            ? "Pants"
            : "Hoodies",
        price: (p.price_cents || 0) / 100,
        originalPrice: p.compare_at_cents ? p.compare_at_cents / 100 : undefined,
        status: isSoldOut ? "Sold out" : "Preorder",
        description: p.description_ar || p.description_en || "",
        sizes: sizes as string[],
        images: imgs.length > 0 ? imgs : ["/preview-images/hoodie-1.jpg"],
        colors: colorsByProd.get(p.id) || [],
        variants: prodVariants,
        href: `/shop/${p.slug}`,
        demo: false,
      };
    });
  } catch (err) {
    console.error("getCatalogProducts error:", err);
    return [];
  }
}
