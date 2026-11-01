import { describe, expect, it } from "vitest";
import { restockProduct, saveProduct, sellOrder, type RestockLine } from "./inventory";
import { createSeedData } from "./seed";
import { formatDelta, stockLogForProduct, stockLogVariantOptions } from "./stock-log";

const seed = createSeedData();
const zip = seed.products.find((p) => p.id === "p_zip_hoodie")!;

describe("stockLogForProduct", () => {
  it("shows only this product, newest first", () => {
    const rows = stockLogForProduct(seed, zip.id);
    expect(rows.length).toBeGreaterThan(3);
    expect(rows.every((r) => zip.variants.some((v) => v.id === r.variantId))).toBe(true);
    const times = rows.map((r) => r.at);
    expect(times).toEqual([...times].sort().reverse());
    expect(rows[rows.length - 1].reason).toBe("initial");
  });

  it("resolves the order number and a readable variant label", () => {
    const sale = stockLogForProduct(seed, zip.id).find((r) => r.reason === "sale")!;
    expect(sale.orderNumber).toMatch(/^TH-\d+$/);
    expect(sale.variantLabel).toMatch(/^Black · (M|L|XL)$/);
    expect(sale.delta).toBeLessThan(0);
    expect(sale.before + sale.delta).toBe(sale.after);
  });

  it("filters by one colour and size", () => {
    const variant = zip.variants.find((v) => v.size === "L")!;
    const rows = stockLogForProduct(seed, zip.id, variant.id);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.variantId === variant.id)).toBe(true);
  });

  it("puts the newest change first when two share a timestamp", () => {
    const id = seed.orders.find((o) => o.number === "TH-1012")!.id;
    const sold = sellOrder(seed, id, "2026-10-30T09:00:00.000Z");
    if (!sold.ok) throw new Error("expected ok");
    const tee = stockLogForProduct(sold.data, "p_oversized_tee");
    expect(tee[0].at).toBe("2026-10-30T09:00:00.000Z");
    expect(tee[0].reason).toBe("sale");
  });

  it("marks changes of a removed colour or size", () => {
    const keep = zip.variants.filter((v) => v.size !== "XL");
    const trimmed = { ...zip, sizes: zip.sizes.filter((s) => s !== "XL"), variants: keep };
    const r = saveProduct(seed, trimmed, "2026-10-30T10:00:00.000Z");
    if (!r.ok) throw new Error("expected ok");
    const rows = stockLogForProduct(r.data, zip.id);
    expect(rows.some((row) => row.variantLabel === null)).toBe(true);
  });

  it("returns nothing for an unknown product", () => {
    expect(stockLogForProduct(seed, "nope")).toEqual([]);
  });

  it("shows a restock with its reason", () => {
    const line: RestockLine = { variantId: zip.variants[0].id, add: 4 };
    const r = restockProduct(seed, zip.id, [line], "Delivery from factory", "2026-10-30T11:00:00.000Z");
    if (!r.ok) throw new Error("expected ok");
    const top = stockLogForProduct(r.data, zip.id)[0];
    expect(top).toMatchObject({ delta: 4, reason: "manual_adjust", note: "Delivery from factory" });
  });
});

describe("helpers", () => {
  it("formats the change with a real minus sign", () => {
    expect(formatDelta(10)).toBe("+10");
    expect(formatDelta(-2)).toBe("\u22122");
    expect(formatDelta(0)).toBe("0");
  });
  it("lists every colour and size for the filter", () => {
    expect(stockLogVariantOptions(zip)).toHaveLength(zip.variants.length);
  });
});
