import { describe, expect, it } from "vitest";
import { deriveProductStatus, duplicateProduct, locateVariant, productTotalStock, saveProduct, uniqueSlug } from "./inventory";
import {
  emptyForm, formToProduct, formTotalStock, isFormEqual, nextColorId, productToForm, setCellStock, sizeChoices, toCents,
  validateForm, withGrid, type ProductForm,
} from "./product-form";
import { createSeedData } from "./seed";

const NOW = "2026-10-30T12:00:00.000Z";
const seed = createSeedData();

function filled(): ProductForm {
  let f: ProductForm = { ...emptyForm("p_new"), name: "Cargo Pants", slug: "cargo-pants", price: 899.5 };
  const colors = [
    { id: "color-1", name: "Black", hex: "#080808" },
    { id: "color-2", name: "Olive", hex: "#4B5320" },
    { id: "color-3", name: "Stone", hex: "#929292" },
  ];
  f = withGrid(f, { colors, sizes: ["XL", "S", "M", "L"] });
  return f;
}

describe("form grid", () => {
  it("3 colours x 4 sizes gives 12 cells, sizes in standard order, and the total updates", () => {
    let f = filled();
    expect(f.sizes).toEqual(["S", "M", "L", "XL"]);
    expect(f.variants).toHaveLength(12);
    f = setCellStock(f, f.variants[0].id, 5);
    f = setCellStock(f, f.variants[11].id, 7);
    expect(formTotalStock(f)).toBe(12);
  });

  it("keeps typed numbers when a size is added or a colour removed", () => {
    let f = filled();
    const id = f.variants.find((v) => v.colorId === "color-2" && v.size === "M")!.id;
    f = setCellStock(f, id, 9);
    f = withGrid(f, { sizes: [...f.sizes, "XXL"] });
    expect(f.variants).toHaveLength(15);
    expect(f.variants.find((v) => v.id === id)!.stock).toBe(9);
    f = withGrid(f, { colors: f.colors.filter((c) => c.id !== "color-1") });
    expect(f.variants).toHaveLength(10);
    expect(f.variants.find((v) => v.id === id)!.stock).toBe(9);
  });

  it("colour ids stay unique and stable", () => {
    expect(nextColorId([])).toBe("color-1");
    expect(nextColorId([{ id: "color-2", name: "a", hex: "#000000" }])).toBe("color-3");
  });

  it("keeps a custom size the product already has", () => {
    const cap = productToForm(seed.products.find((p) => p.id === "p_hop_cap")!);
    expect(sizeChoices(cap)).toContain("One size");
    const odd = { ...cap, sizes: ["34"] };
    expect(sizeChoices(odd)).toContain("34");
  });
});

describe("validation", () => {
  it("a valid form has no errors", () => {
    expect(validateForm(filled(), [])).toEqual({});
  });

  it("name, slug and price are required even for a draft", () => {
    const errors = validateForm({ ...emptyForm("x"), status: "draft" }, []);
    expect(errors).toEqual({ name: "NAME_REQUIRED", slug: "SLUG_REQUIRED", price: "PRICE_REQUIRED" });
  });

  it("colours and sizes are required to publish but not for a draft", () => {
    const base = { ...emptyForm("x"), name: "A", slug: "a", price: 10 };
    expect(validateForm(base, [])).toEqual({ colors: "COLORS_REQUIRED", sizes: "SIZES_REQUIRED" });
    expect(validateForm({ ...base, status: "draft" }, [])).toEqual({});
  });

  it("price must be positive, compare-at must be higher, slug must be clean and unique", () => {
    const f = filled();
    expect(validateForm({ ...f, price: 0 }, []).price).toBe("PRICE_POSITIVE");
    expect(validateForm({ ...f, compareAt: 800 }, []).compareAt).toBe("COMPARE_TOO_LOW");
    expect(validateForm({ ...f, compareAt: 1000 }, []).compareAt).toBeUndefined();
    expect(validateForm({ ...f, slug: "Bad Slug" }, []).slug).toBe("SLUG_FORMAT");
    expect(validateForm(f, ["cargo-pants"]).slug).toBe("SLUG_TAKEN");
  });

  it("colour names must be filled and unique, hex must be valid, stock a whole number", () => {
    const f = filled();
    const dup = { ...f, colors: f.colors.map((c, i) => (i === 1 ? { ...c, name: "black" } : c)) };
    expect(validateForm(dup, []).colors).toBe("COLOR_NAME_DUPLICATE");
    expect(validateForm({ ...f, colors: [{ ...f.colors[0], name: " " }, ...f.colors.slice(1)] }, []).colors).toBe("COLOR_NAME_REQUIRED");
    expect(validateForm({ ...f, colors: [{ ...f.colors[0], hex: "red" }, ...f.colors.slice(1)] }, []).colors).toBe("COLOR_HEX_INVALID");
    expect(validateForm(setCellStock(f, f.variants[0].id, 1.5), []).stock).toBe("STOCK_INVALID");
    expect(validateForm({ ...f, lowStock: -1 }, []).lowStock).toBe("LOW_STOCK_INVALID");
  });

  it("price converts to whole piastres without float drift", () => {
    expect(toCents(899.5)).toBe(89950);
    expect(toCents(0.29)).toBe(29);
    expect(toCents(19.99)).toBe(1999);
  });
});

describe("form <-> product", () => {
  it("round trips every seed product unchanged", () => {
    for (const p of seed.products) {
      expect(isFormEqual(productToForm(p), productToForm(formToProduct(productToForm(p), p, p.updatedAt)))).toBe(true);
      const back = formToProduct(productToForm(p), p, p.updatedAt);
      expect(back).toEqual(p);
    }
  });

  it("status radio maps to stored status and force flag", () => {
    const f = filled();
    expect(formToProduct({ ...f, status: "draft" }, null, NOW)).toMatchObject({ status: "draft", forceSoldOut: false });
    expect(formToProduct({ ...f, status: "sold_out" }, null, NOW)).toMatchObject({ status: "active", forceSoldOut: true });
    expect(formToProduct({ ...f, status: "available" }, null, NOW)).toMatchObject({ status: "active", forceSoldOut: false });
  });
});

describe("saveProduct", () => {
  it("acceptance: new product with 3 colours x 4 sizes shows its total stock and is listed", () => {
    let f = filled();
    f.variants.forEach((v, i) => { f = setCellStock(f, v.id, i + 1); }); // 1..12 = 78
    const r = saveProduct(seed, formToProduct(f, null, NOW), NOW);
    if (!r.ok) throw new Error("expected ok");
    const saved = r.data.products.find((p) => p.id === "p_new")!;
    expect(r.data.products[0].id).toBe("p_new");
    expect(productTotalStock(saved)).toBe(78);
    expect(deriveProductStatus(saved, 3)).toEqual({ kind: "available", total: 78 });
    expect(saved.priceCents).toBe(89950);
  });

  it("logs 'initial' movements for new cells, only for non-zero stock, and the log adds up", () => {
    let f = filled();
    f = setCellStock(f, f.variants[0].id, 4);
    f = setCellStock(f, f.variants[5].id, 6);
    const r = saveProduct(seed, formToProduct(f, null, NOW), NOW);
    if (!r.ok) throw new Error("expected ok");
    const added = r.data.movements.slice(seed.movements.length);
    expect(added).toHaveLength(2);
    expect(added.every((m) => m.reason === "initial" && m.productId === "p_new")).toBe(true);
  });

  it("editing stock logs manual adjustments and keeps the stock log equal to stock everywhere", () => {
    const p = seed.products.find((x) => x.id === "p_oversized_tee")!;
    let f = productToForm(p);
    f = setCellStock(f, f.variants[0].id, f.variants[0].stock + 10);
    f = withGrid(f, { sizes: [...f.sizes, "XXL"] }); // new cells
    f = setCellStock(f, f.variants.find((v) => v.size === "XXL")!.id, 3);
    const r = saveProduct(seed, formToProduct(f, p, NOW), NOW);
    if (!r.ok) throw new Error("expected ok");
    const reasons = r.data.movements.slice(seed.movements.length).map((m) => m.reason).sort();
    expect(reasons).toEqual(["initial", "manual_adjust"]);
    for (const prod of r.data.products) {
      for (const v of prod.variants) {
        const sum = r.data.movements.filter((m) => m.variantId === v.id).reduce((s, m) => s + m.delta, 0);
        expect(sum).toBe(v.stock);
      }
    }
  });

  it("removing a size zeroes its stock in the log first", () => {
    const p = seed.products.find((x) => x.id === "p_oversized_tee")!;
    const f = withGrid(productToForm(p), { sizes: ["S", "M", "L"] }); // drop XL
    const r = saveProduct(seed, formToProduct(f, p, NOW), NOW);
    if (!r.ok) throw new Error("expected ok");
    const xl = p.variants.filter((v) => v.size === "XL");
    for (const v of xl) {
      expect(locateVariant(r.data.products, v.id)).toBeNull();
      expect(r.data.movements.filter((m) => m.variantId === v.id).reduce((s, m) => s + m.delta, 0)).toBe(0);
    }
  });

  it("rejects a taken slug, keeps createdAt on edit, saving unchanged logs nothing", () => {
    const p = seed.products.find((x) => x.id === "p_boxy_tee")!;
    const clash = saveProduct(seed, { ...p, slug: "oversized-tee" }, NOW);
    expect(clash).toEqual({ ok: false, error: "SLUG_TAKEN" });
    const same = saveProduct(seed, formToProduct(productToForm(p), p, NOW), NOW);
    if (!same.ok) throw new Error("expected ok");
    expect(same.data.movements).toHaveLength(seed.movements.length);
    expect(same.data.products.find((x) => x.id === p.id)!.createdAt).toBe(p.createdAt);
  });

  it("zero total stock turns an available product into sold out automatically", () => {
    const f = { ...filled(), status: "available" as const };
    const r = saveProduct(seed, formToProduct(f, null, NOW), NOW);
    if (!r.ok) throw new Error("expected ok");
    expect(deriveProductStatus(r.data.products[0], 3).kind).toBe("sold_out");
  });
});

describe("duplicate", () => {
  it("copies as a draft with zero stock, a new id and a unique slug", () => {
    const r = duplicateProduct(seed, "p_oversized_tee", "p_copy_1", NOW);
    if (!r.ok) throw new Error("expected ok");
    const copy = r.data.products[0];
    expect(copy).toMatchObject({ id: "p_copy_1", name: "Oversized Tee (copy)", status: "draft", slug: "oversized-tee-copy" });
    expect(productTotalStock(copy)).toBe(0);
    expect(copy.variants).toHaveLength(8);
    expect(copy.variants.every((v) => v.id.startsWith("p_copy_1__"))).toBe(true);
    const again = duplicateProduct(r.data, "p_oversized_tee", "p_copy_2", NOW);
    if (!again.ok) throw new Error("expected ok");
    expect(again.data.products[0].slug).toBe("oversized-tee-copy-2");
    expect(r.data.movements).toBe(seed.movements);
  });

  it("uniqueSlug and unknown product", () => {
    expect(uniqueSlug("Cargo Pants", ["cargo-pants"])).toBe("cargo-pants-2");
    expect(duplicateProduct(seed, "nope", "x", NOW)).toEqual({ ok: false, error: "PRODUCT_NOT_FOUND" });
  });
});
