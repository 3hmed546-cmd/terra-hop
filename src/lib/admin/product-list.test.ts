import { describe, expect, it } from "vitest";
import { canMakeAvailable, deriveProductStatus, openOrdersForProduct, quickStatusOf, setProductStatus, deleteProduct } from "./inventory";
import { countByStatus, DEFAULT_QUERY, isDefaultQuery, queryProducts, type ListQuery } from "./product-list";
import { createSeedData } from "./seed";

const NOW = "2026-10-30T10:00:00.000Z";
const seed = createSeedData();
const T = seed.settings.lowStockThreshold;
const q = (patch: Partial<ListQuery>): ListQuery => ({ ...DEFAULT_QUERY, ...patch });
const names = (list: { name: string }[]) => list.map((p) => p.name);

describe("products list: counts and filters", () => {
  it("counts per status add up to the total", () => {
    const c = countByStatus(seed.products, T);
    expect(c.all).toBe(8);
    expect(c.available + c.low + c.sold_out + c.draft).toBe(c.all);
    expect(c.draft).toBe(1);
    expect(c.sold_out).toBe(2); // Archive Tee (0 stock) + Hop Cap (forced)
  });

  it("status filter returns only products of that derived status", () => {
    for (const kind of ["available", "low", "sold_out", "draft"] as const) {
      for (const p of queryProducts(seed.products, q({ status: kind }), T)) {
        expect(deriveProductStatus(p, T).kind).toBe(kind);
      }
    }
    expect(names(queryProducts(seed.products, q({ status: "draft" }), T))).toEqual(["Fleece Pullover"]);
  });

  it("search matches name words in any case and order, plus category", () => {
    expect(names(queryProducts(seed.products, q({ search: "  HOODIE " }), T)).sort()).toEqual(
      ["Fleece Pullover", "Terra Hoodie", "Zip Hoodie"].sort(),
    );
    expect(names(queryProducts(seed.products, q({ search: "tee boxy" }), T))).toEqual(["Boxy Tee"]);
    expect(queryProducts(seed.products, q({ search: "nonexistent" }), T)).toEqual([]);
  });

  it("search and status filter combine", () => {
    expect(names(queryProducts(seed.products, q({ search: "tee", status: "sold_out" }), T))).toEqual(["Archive Tee"]);
  });

  it("does not mutate the input array", () => {
    const before = seed.products.map((p) => p.id);
    queryProducts(seed.products, q({ sort: "price_desc" }), T);
    expect(seed.products.map((p) => p.id)).toEqual(before);
  });

  it("isDefaultQuery ignores sort and blank search", () => {
    expect(isDefaultQuery(q({ sort: "name", search: "  " }))).toBe(true);
    expect(isDefaultQuery(q({ status: "draft" }))).toBe(false);
  });
});

describe("products list: sorting", () => {
  it("sorts by name, price and stock", () => {
    const byName = names(queryProducts(seed.products, q({ sort: "name" }), T));
    expect(byName).toEqual([...byName].sort((a, b) => a.localeCompare(b)));
    const asc = queryProducts(seed.products, q({ sort: "price_asc" }), T).map((p) => p.priceCents);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const desc = queryProducts(seed.products, q({ sort: "price_desc" }), T).map((p) => p.priceCents);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    expect(names(queryProducts(seed.products, q({ sort: "stock_asc" }), T))[0]).toBe("Archive Tee");
  });

  it("recently updated puts the newest first", () => {
    const updated = setProductStatus(seed, "p_boxy_tee", "draft", NOW);
    if (!updated.ok) throw new Error("expected ok");
    expect(queryProducts(updated.data.products, q({ sort: "updated" }), T)[0].id).toBe("p_boxy_tee");
  });
});

describe("quick status (A1)", () => {
  it("maps derived status to the three quick states", () => {
    const get = (id: string) => seed.products.find((p) => p.id === id)!;
    expect(quickStatusOf(get("p_oversized_tee"), T)).toBe("available");
    expect(quickStatusOf(get("p_zip_hoodie"), T)).toBe("available"); // 6 pieces, above threshold
    expect(quickStatusOf(get("p_hop_cap"), T)).toBe("sold_out");
    expect(quickStatusOf(get("p_archive_tee"), T)).toBe("sold_out");
    expect(quickStatusOf(get("p_fleece_pullover"), T)).toBe("draft");
  });

  it("a product with no stock cannot be made available", () => {
    const archive = seed.products.find((p) => p.id === "p_archive_tee")!;
    expect(canMakeAvailable(archive)).toBe(false);
    const r = setProductStatus(seed, "p_archive_tee", "available", NOW);
    expect(r).toEqual({ ok: false, error: "NO_STOCK" });
  });

  it("sold out -> available -> draft round trip, each visible in the derived status", () => {
    const so = setProductStatus(seed, "p_oversized_tee", "sold_out", NOW);
    if (!so.ok) throw new Error("expected ok");
    expect(deriveProductStatus(so.data.products.find((p) => p.id === "p_oversized_tee")!, T).kind).toBe("sold_out");
    const av = setProductStatus(so.data, "p_oversized_tee", "available", NOW);
    if (!av.ok) throw new Error("expected ok");
    expect(deriveProductStatus(av.data.products.find((p) => p.id === "p_oversized_tee")!, T).kind).toBe("available");
    const dr = setProductStatus(av.data, "p_oversized_tee", "draft", NOW);
    if (!dr.ok) throw new Error("expected ok");
    expect(deriveProductStatus(dr.data.products.find((p) => p.id === "p_oversized_tee")!, T).kind).toBe("draft");
  });

  it("changing status never touches stock or the stock log", () => {
    const r = setProductStatus(seed, "p_oversized_tee", "sold_out", NOW);
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.movements).toBe(seed.movements);
    expect(r.data.products.find((p) => p.id === "p_oversized_tee")!.variants).toEqual(
      seed.products.find((p) => p.id === "p_oversized_tee")!.variants,
    );
  });
});

describe("delete (A1)", () => {
  it("removes the product but keeps orders and the stock log", () => {
    const r = deleteProduct(seed, "p_boxy_tee");
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.products.some((p) => p.id === "p_boxy_tee")).toBe(false);
    expect(r.data.orders).toBe(seed.orders);
    expect(r.data.movements).toBe(seed.movements);
  });

  it("unknown product is an error", () => {
    expect(deleteProduct(seed, "nope")).toEqual({ ok: false, error: "PRODUCT_NOT_FOUND" });
  });

  it("openOrdersForProduct counts only orders waiting for email or a decision", () => {
    for (const p of seed.products) {
      for (const o of openOrdersForProduct(seed, p.id)) {
        expect(["PENDING_EMAIL", "AWAITING_APPROVAL"]).toContain(o.status);
        expect(o.items.some((i) => i.productId === p.id)).toBe(true);
      }
    }
    const total = seed.products.reduce((s, p) => s + openOrdersForProduct(seed, p.id).length, 0);
    expect(total).toBeGreaterThan(0);
  });
});
