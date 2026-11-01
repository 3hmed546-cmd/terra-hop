import { describe, expect, it } from "vitest";
import { openOrdersLosingVariants, saveProduct, sellOrder, cancelOrder, recordManualSale, deriveProductStatus } from "./inventory";
import { confirmOrderEmail, simulateWebsiteOrder } from "./orders";
import { createSeedData } from "./seed";
import type { AdminData, Product } from "./types";

const NOW = "2026-10-31T10:00:00.000Z";
const product = (d: AdminData, id: string) => d.products.find((p) => p.id === id)!;
const must = <T,>(r: { ok: true; data: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(r.error);
  return r.data;
};
const without = (p: Product, colorId: string): Product => ({
  ...p,
  colors: p.colors.filter((c) => c.id !== colorId),
  variants: p.variants.filter((v) => v.colorId !== colorId),
});

describe("removing colours or sizes that open orders use", () => {
  it("names the open orders that would be left unsellable", () => {
    const data = createSeedData();
    // TH-1011 (waiting for email) and TH-1012 (needs action) use the Oversized Tee in Black.
    const next = without(product(data, "p_oversized_tee"), "black");
    const hits = openOrdersLosingVariants(data, "p_oversized_tee", next);
    expect(hits.map((h) => h.orderNumber).sort()).toEqual(["TH-1011", "TH-1012"]);
    expect(hits.find((h) => h.orderNumber === "TH-1012")!.items).toContain("Oversized Tee · Black · L × 2");
  });

  it("finds nothing when the removed colour has no open order", () => {
    const data = createSeedData();
    const tee = product(data, "p_oversized_tee");
    const colorWithoutOrders = tee.colors.find((c) => c.id !== "black")!;
    expect(openOrdersLosingVariants(data, tee.id, without(tee, colorWithoutOrders.id))).toEqual([]);
  });

  it("finds nothing for an unchanged product, a new product, or a closed order", () => {
    const data = createSeedData();
    const tee = product(data, "p_oversized_tee");
    expect(openOrdersLosingVariants(data, tee.id, tee)).toEqual([]);
    expect(openOrdersLosingVariants(data, "p_brand_new", { ...tee, id: "p_brand_new" })).toEqual([]);
    // sold orders are history, not open: the zip hoodie in Black L was sold in TH-1007
    const zip = product(data, "p_zip_hoodie");
    const hits = openOrdersLosingVariants(data, zip.id, without(zip, "black"));
    expect(hits.some((h) => h.orderNumber === "TH-1007")).toBe(false);
  });

  it("stops warning once the order is cancelled", () => {
    let data = createSeedData();
    data = must(cancelOrder(data, "ord_1012", "Customer changed their mind", NOW));
    data = must(cancelOrder(data, "ord_1011", "", NOW));
    const next = without(product(data, "p_oversized_tee"), "black");
    expect(openOrdersLosingVariants(data, "p_oversized_tee", next)).toEqual([]);
  });
});

describe("full scenario (A5 acceptance): new product, new order, sale, cancel, manual sale", () => {
  it("keeps stock, status and the stock log consistent from start to finish", () => {
    let data = createSeedData();

    // 1. a new product with 2 colours and 2 sizes, 4 pieces each
    const base = product(data, "p_boxy_tee");
    const fresh: Product = {
      ...base,
      id: "p_scenario",
      slug: "scenario-tee",
      name: "Scenario Tee",
      status: "active",
      forceSoldOut: false,
      colors: base.colors.slice(0, 2),
      sizes: ["M", "L"],
      variants: base.colors.slice(0, 2).flatMap((c) =>
        ["M", "L"].map((size) => ({ id: `p_scenario:${c.id}:${size}`, colorId: c.id, size, stock: 4 })),
      ),
    };
    data = must(saveProduct(data, fresh, NOW));
    expect(product(data, "p_scenario").variants.reduce((n, v) => n + v.stock, 0)).toBe(16);
    expect(deriveProductStatus(product(data, "p_scenario"), data.settings.lowStockThreshold).kind).toBe("available");

    // 2. a customer order for it arrives and confirms by email
    const before = data.orders.length;
    const placed = must(simulateWebsiteOrder(data, "pending", NOW, 1));
    expect(placed.orders.length).toBe(before + 1);
    const pending = placed.orders[placed.orders.length - 1]!;
    expect(pending.status).toBe("PENDING_EMAIL");
    data = must(confirmOrderEmail(placed, pending.id, NOW));
    expect(data.orders.find((o) => o.id === pending.id)!.status).toBe("AWAITING_APPROVAL");

    // 3. it is sold: stock drops by the ordered quantity, once
    const stockSum = (d: AdminData) => d.products.reduce((n, p) => n + p.variants.reduce((m, v) => m + v.stock, 0), 0);
    const pieces = pending.items.reduce((n, i) => n + i.qty, 0);
    const beforeSale = stockSum(data);
    data = must(sellOrder(data, pending.id, NOW));
    expect(stockSum(data)).toBe(beforeSale - pieces);
    expect(sellOrder(data, pending.id, NOW).ok).toBe(false); // no double sale

    // 4. it is cancelled after the sale: the same pieces come back
    data = must(cancelOrder(data, pending.id, "Customer refused delivery", NOW));
    expect(stockSum(data)).toBe(beforeSale);
    expect(data.orders.find((o) => o.id === pending.id)!.status).toBe("CANCELLED");

    // 5. a manual sale of the new product
    const variant = product(data, "p_scenario").variants[0]!;
    data = must(recordManualSale(data, { variantId: variant.id, qty: 3, unitPriceCents: 90000, buyerName: "", note: "Pop-up" }, NOW));
    const manual = data.orders[data.orders.length - 1]!;
    expect(manual.source).toBe("manual");
    expect(manual.status).toBe("SOLD");
    expect(product(data, "p_scenario").variants[0]!.stock).toBe(1);

    // 6. the stock log still adds up to the stock on hand, for every variant
    for (const p of data.products) {
      for (const v of p.variants) {
        const logged = data.movements.filter((m) => m.variantId === v.id).reduce((n, m) => n + m.delta, 0);
        expect(logged).toBe(v.stock);
      }
    }
  });
});
