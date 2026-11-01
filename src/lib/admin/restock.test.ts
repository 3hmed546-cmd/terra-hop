import { describe, expect, it } from "vitest";
import { deriveProductStatus, locateVariant, productTotalStock, restockProduct } from "./inventory";
import { createSeedData } from "./seed";

const seed = createSeedData();
const NOW = "2026-10-30T12:00:00.000Z";
const tee = seed.products.find((p) => p.id === "p_oversized_tee")!;
const stockOf = (d: typeof seed, id: string) => locateVariant(d.products, id)!.variant.stock;

describe("restockProduct", () => {
  it("adds to several cells at once and logs each one", () => {
    const [a, b] = tee.variants;
    const r = restockProduct(seed, tee.id, [{ variantId: a.id, add: 5 }, { variantId: b.id, add: 3 }], "Delivery", NOW);
    if (!r.ok) throw new Error("expected ok");
    expect(stockOf(r.data, a.id)).toBe(a.stock + 5);
    expect(stockOf(r.data, b.id)).toBe(b.stock + 3);
    const added = r.data.movements.slice(seed.movements.length);
    expect(added).toHaveLength(2);
    expect(added.every((m) => m.reason === "manual_adjust" && m.note === "Delivery")).toBe(true);
    expect(productTotalStock(r.data.products.find((p) => p.id === tee.id)!)).toBe(productTotalStock(tee) + 8);
  });

  it("logs 'Restock' when no reason is given", () => {
    const r = restockProduct(seed, tee.id, [{ variantId: tee.variants[0].id, add: 1 }], "   ", NOW);
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.movements.at(-1)!.note).toBe("Restock");
  });

  it("ignores empty lines, and refuses when nothing is added", () => {
    const [a, b] = tee.variants;
    const some = restockProduct(seed, tee.id, [{ variantId: a.id, add: 0 }, { variantId: b.id, add: 2 }], "", NOW);
    if (!some.ok) throw new Error("expected ok");
    expect(some.data.movements.length).toBe(seed.movements.length + 1);
    expect(restockProduct(seed, tee.id, [{ variantId: a.id, add: 0 }], "", NOW)).toEqual({ ok: false, error: "NO_CHANGE" });
    expect(restockProduct(seed, tee.id, [], "", NOW)).toEqual({ ok: false, error: "NO_CHANGE" });
  });

  it("is all or nothing", () => {
    const bad = restockProduct(seed, tee.id, [{ variantId: tee.variants[0].id, add: 5 }, { variantId: "ghost", add: 1 }], "", NOW);
    expect(bad).toEqual({ ok: false, error: "VARIANT_NOT_FOUND" });
    const other = seed.products.find((p) => p.id === "p_boxy_tee")!.variants[0];
    expect(restockProduct(seed, tee.id, [{ variantId: other.id, add: 1 }], "", NOW)).toEqual({ ok: false, error: "VARIANT_NOT_FOUND" });
  });

  it("rejects negative and fractional amounts and unknown products", () => {
    const v = tee.variants[0].id;
    expect(restockProduct(seed, tee.id, [{ variantId: v, add: -1 }], "", NOW)).toEqual({ ok: false, error: "INVALID_QUANTITY" });
    expect(restockProduct(seed, tee.id, [{ variantId: v, add: 1.5 }], "", NOW)).toEqual({ ok: false, error: "INVALID_QUANTITY" });
    expect(restockProduct(seed, "nope", [{ variantId: v, add: 1 }], "", NOW)).toEqual({ ok: false, error: "PRODUCT_NOT_FOUND" });
  });

  it("brings a sold-out product back to Available", () => {
    const archive = seed.products.find((p) => p.id === "p_archive_tee")!;
    expect(deriveProductStatus(archive, 3).kind).toBe("sold_out");
    const r = restockProduct(seed, archive.id, [{ variantId: archive.variants[0].id, add: 10 }], "Reprint", NOW);
    if (!r.ok) throw new Error("expected ok");
    expect(deriveProductStatus(r.data.products.find((p) => p.id === archive.id)!, 3).kind).toBe("available");
  });
});
