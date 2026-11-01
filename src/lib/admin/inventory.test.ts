import { describe, expect, it } from "vitest";
import {
  acceptsOrders,
  adjustStock,
  cancelOrder,
  checkOrderStock,
  deriveProductStatus,
  generateVariants,
  locateVariant,
  nextOrderNumber,
  productTotalStock,
  recordManualSale,
  sellOrder,
  setProductStatus,
} from "./inventory";
import { createSeedData } from "./seed";
import { formatMoney, slugify } from "./format";
import { isNavActive, relativeAdminPath } from "./paths";
import type { AdminData, Product } from "./types";

const NOW = "2026-10-29T20:00:00.000Z";
const byNumber = (d: AdminData, n: string) => d.orders.find((o) => o.number === n)!;
const stockOf = (d: AdminData, id: string) => locateVariant(d.products, id)!.variant.stock;
const product = (d: AdminData, id: string): Product => d.products.find((p) => p.id === id)!;

describe("seed data", () => {
  const seed = createSeedData();

  it("has 8 products and 12 orders across every status", () => {
    expect(seed.products).toHaveLength(8);
    expect(seed.orders).toHaveLength(12);
    const statuses = new Set(seed.orders.map((o) => o.status));
    expect(statuses).toEqual(new Set(["PENDING_EMAIL", "AWAITING_APPROVAL", "SOLD", "CANCELLED", "EXPIRED"]));
  });

  it("stock log adds up to current stock for every variant, never negative", () => {
    for (const p of seed.products) {
      for (const v of p.variants) {
        const sum = seed.movements.filter((m) => m.variantId === v.id).reduce((s, m) => s + m.delta, 0);
        expect(sum).toBe(v.stock);
        expect(v.stock).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("order numbers are sequential from TH-1001 and totals add up", () => {
    expect(seed.orders.map((o) => o.number)).toEqual(
      Array.from({ length: 12 }, (_, i) => `TH-${1001 + i}`),
    );
    for (const o of seed.orders) {
      const items = o.items.reduce((s, i) => s + i.priceCentsSnapshot * i.qty, 0);
      expect(o.totalCents).toBe(items + o.shippingCents);
    }
  });

  it("shows every derived product status", () => {
    const kinds = seed.products.map((p) => deriveProductStatus(p, 3).kind);
    expect(new Set(kinds)).toEqual(new Set(["available", "low", "sold_out", "draft"]));
  });
});

describe("deriveProductStatus", () => {
  const base = createSeedData().products[0];
  const withStock = (n: number, patch: Partial<Product> = {}): Product => ({
    ...base,
    ...patch,
    variants: base.variants.map((v, i) => ({ ...v, stock: i === 0 ? n : 0 })),
  });

  it("zero stock is sold out, a few is low, plenty is available", () => {
    expect(deriveProductStatus(withStock(0), 3).kind).toBe("sold_out");
    expect(deriveProductStatus(withStock(3), 3).kind).toBe("low");
    expect(deriveProductStatus(withStock(4), 3).kind).toBe("available");
  });
  it("draft wins over everything, force sold out wins over stock", () => {
    expect(deriveProductStatus(withStock(0, { status: "draft" }), 3).kind).toBe("draft");
    expect(deriveProductStatus(withStock(50, { forceSoldOut: true }), 3).kind).toBe("sold_out");
  });
  it("per-product threshold overrides the default", () => {
    expect(deriveProductStatus(withStock(8, { lowStockThreshold: 10 }), 3).kind).toBe("low");
  });
  it("only available and low products accept orders", () => {
    expect(acceptsOrders(withStock(5), 3)).toBe(true);
    expect(acceptsOrders(withStock(2), 3)).toBe(true);
    expect(acceptsOrders(withStock(0), 3)).toBe(false);
    expect(acceptsOrders(withStock(5, { status: "draft" }), 3)).toBe(false);
  });
});

describe("sellOrder", () => {
  const seed = createSeedData();

  it("deducts stock for every item and marks SOLD", () => {
    const order = byNumber(seed, "TH-1012"); // Tee Black L x2 + Terra Hoodie Black M x1
    const before = order.items.map((i) => stockOf(seed, i.variantId));
    const r = sellOrder(seed, order.id, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    order.items.forEach((item, i) => expect(stockOf(r.data, item.variantId)).toBe(before[i] - item.qty));
    expect(byNumber(r.data, "TH-1012").status).toBe("SOLD");
    expect(r.data.movements.filter((m) => m.orderId === order.id && m.reason === "sale")).toHaveLength(2);
  });

  it("is all-or-nothing when one item lacks stock", () => {
    const order = byNumber(seed, "TH-1008"); // Terra Hoodie Olive M has 0 in stock
    expect(checkOrderStock(seed, order).some((l) => !l.ok)).toBe(true);
    const r = sellOrder(seed, order.id, NOW);
    expect(r).toEqual({ ok: false, error: "INSUFFICIENT_STOCK" });
    expect(seed.orders.find((o) => o.id === order.id)!.status).toBe("AWAITING_APPROVAL");
  });

  it("cannot be applied twice", () => {
    const id = byNumber(seed, "TH-1012").id;
    const once = sellOrder(seed, id, NOW);
    if (!once.ok) throw new Error("expected ok");
    expect(sellOrder(once.data, id, NOW)).toEqual({ ok: false, error: "ORDER_NOT_AWAITING" });
  });

  it("rejects orders still waiting for the customer's email", () => {
    expect(sellOrder(seed, byNumber(seed, "TH-1010").id, NOW)).toEqual({ ok: false, error: "ORDER_NOT_AWAITING" });
  });

  it("stock check reports available and remaining", () => {
    const lines = checkOrderStock(seed, byNumber(seed, "TH-1012"));
    const tee = lines.find((l) => l.label.startsWith("Oversized Tee"))!;
    expect(tee).toMatchObject({ requested: 2, ok: true, after: tee.available - 2 });
  });

  it("running stock down to zero flips the product to sold out", () => {
    let d = seed;
    const zip = product(d, "p_zip_hoodie");
    expect(deriveProductStatus(zip, 3).kind).toBe("low");
    for (const v of zip.variants) {
      const r = adjustStock(d, v.id, 0, "test", NOW);
      if (r.ok) d = r.data;
    }
    expect(deriveProductStatus(product(d, "p_zip_hoodie"), 3).kind).toBe("sold_out");
  });
});

describe("cancelOrder", () => {
  const seed = createSeedData();

  it("cancelling an order that was never sold leaves stock untouched", () => {
    const o = byNumber(seed, "TH-1009");
    const r = cancelOrder(seed, o.id, "No answer", NOW);
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.products).toEqual(seed.products);
    expect(r.data.movements).toHaveLength(seed.movements.length);
    expect(byNumber(r.data, "TH-1009")).toMatchObject({ status: "CANCELLED", cancelReason: "No answer" });
  });

  it("cancelling after sold returns exactly the sold quantities", () => {
    const id = byNumber(seed, "TH-1012").id;
    const sold = sellOrder(seed, id, NOW);
    if (!sold.ok) throw new Error("expected ok");
    const cancelled = cancelOrder(sold.data, id, "Customer refused", NOW);
    if (!cancelled.ok) throw new Error("expected ok");
    expect(cancelled.data.products.map(productTotalStock)).toEqual(seed.products.map(productTotalStock));
    expect(cancelled.data.movements.filter((m) => m.reason === "cancel_restock")).toHaveLength(
      seed.movements.filter((m) => m.reason === "cancel_restock").length + 2,
    );
  });

  it("cannot change an order that is already cancelled or expired", () => {
    expect(cancelOrder(seed, byNumber(seed, "TH-1004").id, "", NOW)).toEqual({ ok: false, error: "ORDER_ALREADY_CLOSED" });
    expect(cancelOrder(seed, byNumber(seed, "TH-1006").id, "", NOW)).toEqual({ ok: false, error: "ORDER_ALREADY_CLOSED" });
  });

  it("sell, cancel, then sell again is refused (cancelled is final)", () => {
    const id = byNumber(seed, "TH-1012").id;
    const a = sellOrder(seed, id, NOW);
    if (!a.ok) throw new Error("expected ok");
    const b = cancelOrder(a.data, id, "", NOW);
    if (!b.ok) throw new Error("expected ok");
    expect(sellOrder(b.data, id, NOW)).toEqual({ ok: false, error: "ORDER_NOT_AWAITING" });
  });
});

describe("recordManualSale", () => {
  const seed = createSeedData();
  const variant = product(seed, "p_oversized_tee").variants.find((v) => v.colorId === "black" && v.size === "M")!;

  it("creates a SOLD manual order and deducts stock", () => {
    const r = recordManualSale(seed, { variantId: variant.id, qty: 2, unitPriceCents: 40000, note: "Pop-up" }, NOW);
    if (!r.ok) throw new Error("expected ok");
    const order = r.data.orders[r.data.orders.length - 1];
    expect(order).toMatchObject({ source: "manual", status: "SOLD", number: "TH-1013", totalCents: 80000 });
    expect(stockOf(r.data, variant.id)).toBe(variant.stock - 2);
  });
  it("refuses more than the available stock, and bad numbers", () => {
    expect(recordManualSale(seed, { variantId: variant.id, qty: variant.stock + 1, unitPriceCents: 100 }, NOW)).toEqual({ ok: false, error: "INSUFFICIENT_STOCK" });
    expect(recordManualSale(seed, { variantId: variant.id, qty: 0, unitPriceCents: 100 }, NOW)).toEqual({ ok: false, error: "INVALID_QUANTITY" });
    expect(recordManualSale(seed, { variantId: variant.id, qty: 1, unitPriceCents: -1 }, NOW)).toEqual({ ok: false, error: "INVALID_PRICE" });
  });
});

describe("stock adjustments and product status", () => {
  const seed = createSeedData();
  const variant = product(seed, "p_long_sleeve").variants[0];

  it("sets an exact count and logs the difference", () => {
    const r = adjustStock(seed, variant.id, variant.stock + 10, "Restock", NOW);
    if (!r.ok) throw new Error("expected ok");
    expect(stockOf(r.data, variant.id)).toBe(variant.stock + 10);
    expect(r.data.movements.at(-1)).toMatchObject({ delta: 10, reason: "manual_adjust", note: "Restock" });
  });
  it("rejects negatives, fractions and no-ops", () => {
    expect(adjustStock(seed, variant.id, -1, "", NOW)).toEqual({ ok: false, error: "INVALID_QUANTITY" });
    expect(adjustStock(seed, variant.id, 1.5, "", NOW)).toEqual({ ok: false, error: "INVALID_QUANTITY" });
    expect(adjustStock(seed, variant.id, variant.stock, "", NOW)).toEqual({ ok: false, error: "NO_CHANGE" });
  });
  it("quick status changes map to status and force flag", () => {
    const r = setProductStatus(seed, "p_hop_cap", "available", NOW);
    if (!r.ok) throw new Error("expected ok");
    expect(deriveProductStatus(product(r.data, "p_hop_cap"), 3).kind).toBe("available");
    const d = setProductStatus(r.data, "p_hop_cap", "draft", NOW);
    if (!d.ok) throw new Error("expected ok");
    expect(deriveProductStatus(product(d.data, "p_hop_cap"), 3).kind).toBe("draft");
  });
});

describe("helpers", () => {
  it("generateVariants builds the grid and keeps existing stock", () => {
    const colors = [{ id: "a", name: "A", hex: "#000000" }, { id: "b", name: "B", hex: "#111111" }];
    const first = generateVariants("p", colors, ["S", "M"]);
    expect(first).toHaveLength(4);
    const edited = first.map((v) => (v.colorId === "a" && v.size === "M" ? { ...v, stock: 7 } : v));
    const next = generateVariants("p", colors, ["S", "M", "L"], edited);
    expect(next).toHaveLength(6);
    expect(next.find((v) => v.colorId === "a" && v.size === "M")!.stock).toBe(7);
    expect(next.find((v) => v.size === "L")!.stock).toBe(0);
  });
  it("nextOrderNumber starts at TH-1001", () => {
    expect(nextOrderNumber([])).toBe("TH-1001");
  });
  it("formats money and slugs", () => {
    expect(formatMoney(140000)).toBe("EGP 1,400");
    expect(formatMoney(140050)).toBe("EGP 1,400.50");
    expect(slugify("Oversized Tee (Black)")).toBe("oversized-tee-black");
    expect(slugify("تيشيرت")).toBe("product");
  });
  it("maps public admin URLs to internal paths", () => {
    expect(relativeAdminPath("/x-panel/products/new", "/x-panel")).toBe("/products/new");
    expect(relativeAdminPath("/admin/orders", "/x-panel")).toBe("/orders");
    expect(isNavActive("/products/new", "/products")).toBe(true);
    expect(isNavActive("/productsX", "/products")).toBe(false);
  });
});
