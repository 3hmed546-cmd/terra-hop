import { describe, expect, it } from "vitest";
import { recordManualSale, reservedQuantities } from "./inventory";
import { createSeedData } from "./seed";
import {
  changeColor, changeProduct, initialSaleForm, saleAvailability, saleTotalCents, sellableProducts, toSaleInput, validateSale, variantOfForm,
} from "./sale-form";
import type { AdminData } from "./types";

const seed = createSeedData();
const NOW = "2026-10-30T12:00:00.000Z";

describe("initial state and switching", () => {
  it("starts on the first product that has stock, with its price and first sellable variant", () => {
    const f = initialSaleForm(seed);
    const product = sellableProducts(seed)[0];
    expect(f.productId).toBe(product.id);
    expect(f.price).toBe(product.priceCents / 100);
    expect(variantOfForm(seed, f)!.stock).toBeGreaterThan(0);
    expect(f.qty).toBe(1);
  });

  it("does not offer products with nothing left", () => {
    expect(sellableProducts(seed).map((p) => p.name)).not.toContain("Archive Tee");
    expect(sellableProducts(seed).map((p) => p.name)).toContain("Fleece Pullover"); // draft with stock
  });

  it("changing product resets colour, size and price but keeps what was typed", () => {
    const f = { ...initialSaleForm(seed), buyer: "Sara", note: "Pop-up", qty: 2 };
    const hoodie = seed.products.find((p) => p.id === "p_terra_hoodie")!;
    const g = changeProduct(seed, f, hoodie.id);
    expect(g).toMatchObject({ productId: hoodie.id, price: 1400, buyer: "Sara", note: "Pop-up", qty: 2 });
    expect(variantOfForm(seed, g)!.stock).toBeGreaterThan(0);
  });

  it("skips Olive M (nothing left) and starts on the first cell that has stock", () => {
    const g = changeProduct(seed, initialSaleForm(seed), "p_terra_hoodie");
    expect(g).toMatchObject({ colorId: "olive", size: "L" });
    expect(variantOfForm(seed, g)!.stock).toBeGreaterThan(0);
  });

  it("changing colour keeps the size when possible, else moves to one in stock", () => {
    const base = changeProduct(seed, initialSaleForm(seed), "p_terra_hoodie");
    const toOlive = changeColor(seed, { ...base, colorId: "black", size: "M" }, "olive");
    expect(toOlive.colorId).toBe("olive");
    expect(variantOfForm(seed, toOlive)!.stock).toBeGreaterThan(0); // Olive M is 0, so it moved on
    expect(toOlive.size).not.toBe("M");
    const tee = changeProduct(seed, initialSaleForm(seed), "p_oversized_tee");
    expect(changeColor(seed, { ...tee, colorId: "black", size: "L" }, "off-white").size).toBe("L");
  });
});

describe("validateSale", () => {
  const good = changeProduct(seed, initialSaleForm(seed), "p_oversized_tee");

  it("accepts a normal sale", () => {
    expect(validateSale(seed, good)).toEqual({});
  });
  it("flags quantity: empty, zero, fractional and more than in stock", () => {
    expect(validateSale(seed, { ...good, qty: null }).qty).toBe("qty");
    expect(validateSale(seed, { ...good, qty: 0 }).qty).toBe("qty");
    expect(validateSale(seed, { ...good, qty: 1.5 }).qty).toBe("qty");
    expect(validateSale(seed, { ...good, qty: 999 }).qty).toBe("qtyTooMany");
  });
  it("flags price and missing choices", () => {
    expect(validateSale(seed, { ...good, price: null }).price).toBe("price");
    expect(validateSale(seed, { ...good, price: -1 }).price).toBe("price");
    expect(validateSale(seed, { ...good, price: 0 }).price).toBeUndefined();
    expect(validateSale(seed, { ...good, productId: "" }).product).toBe("product");
    expect(validateSale(seed, { ...good, colorId: "pink" }).color).toBe("color");
    expect(validateSale(seed, { ...good, size: "XXL" }).size).toBe("size");
  });
});

describe("saleAvailability", () => {
  const f = changeProduct(seed, initialSaleForm(seed), "p_oversized_tee");
  it("shows in stock now and what is left", () => {
    const v = variantOfForm(seed, f)!;
    expect(saleAvailability(seed, { ...f, qty: 2 })).toMatchObject({ inStock: v.stock, afterSale: v.stock - 2, held: 0, usesHeld: false });
  });
  it("with holds on, warns only when the sale eats into held pieces", () => {
    const hold: AdminData = { ...seed, settings: { ...seed.settings, reservation: "hold" } };
    const stockById = new Map(hold.products.flatMap((p) => p.variants.map((v) => [v.id, v.stock] as const)));
    const [variantId, held] = [...reservedQuantities(hold).entries()].find(([id]) => (stockById.get(id) ?? 0) > 0)!;
    const product = hold.products.find((p) => p.variants.some((v) => v.id === variantId))!;
    const v = product.variants.find((x) => x.id === variantId)!;
    const form = { ...f, productId: product.id, colorId: v.colorId, size: v.size };
    expect(saleAvailability(hold, { ...form, qty: v.stock - held })!.usesHeld).toBe(false);
    expect(saleAvailability(hold, { ...form, qty: v.stock - held + 1 })).toMatchObject({ held, usesHeld: true });
    expect(saleAvailability(hold, { ...form, qty: v.stock + 1 })!.usesHeld).toBe(false); // too many: a plain error instead
  });
});

describe("recording the sale", () => {
  it("turns the form into a manual SOLD order with the typed price", () => {
    const f = { ...changeProduct(seed, initialSaleForm(seed), "p_oversized_tee"), qty: 2, price: 399.5, buyer: " Sara ", note: " Pop-up " };
    const v = variantOfForm(seed, f)!;
    const input = toSaleInput(f, v.id);
    expect(input).toMatchObject({ qty: 2, unitPriceCents: 39950, buyerName: "Sara", note: "Pop-up" });
    expect(saleTotalCents(f)).toBe(79900);
    const r = recordManualSale(seed, input, NOW);
    if (!r.ok) throw new Error("expected ok");
    const order = r.data.orders.at(-1)!;
    expect(order).toMatchObject({ source: "manual", status: "SOLD", totalCents: 79900, shippingCents: 0 });
    expect(order.customer.name).toBe("Sara");
    expect(r.data.products.find((p) => p.id === f.productId)!.variants.find((x) => x.id === v.id)!.stock).toBe(v.stock - 2);
  });
});
