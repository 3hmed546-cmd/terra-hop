/**
 * Pure helpers for the add/edit product form: state shape, conversion to and from Product,
 * and validation. No React, no storage: the same rules can run on the server in B2.
 */
import { generateVariants } from "./inventory";
import type { ColorOption, Product, ProductCategory, ProductDetails, ProductImage, Variant } from "./types";

export const SIZE_OPTIONS = ["S", "M", "L", "XL", "XXL", "One size"] as const;
export const PANTS_SIZE_OPTIONS = ["28", "30", "32", "34", "36", "38", "40", "S", "M", "L", "XL", "XXL"] as const;
export const MAX_IMAGES = 8;
export const MAX_COLORS = 12;
export const DEFAULT_COLOR_HEX = "#080808";

export type FormStatus = "available" | "sold_out" | "draft";

export interface ProductForm {
  productId: string;
  name: string;
  slug: string;
  /** Once the owner edits the slug by hand it stops following the name. */
  slugTouched: boolean;
  description: string;
  category: ProductCategory;
  /** EGP, up to 2 decimals */
  price: number | null;
  compareAt: number | null;
  images: ProductImage[];
  colors: ColorOption[];
  sizes: string[];
  variants: Variant[];
  status: FormStatus;
  /** null = use the store default from settings */
  lowStock: number | null;
  details: ProductDetails;
}

export function emptyForm(productId: string): ProductForm {
  return {
    productId,
    name: "",
    slug: "",
    slugTouched: false,
    description: "",
    category: "tshirt",
    price: null,
    compareAt: null,
    images: [],
    colors: [],
    sizes: [],
    variants: [],
    status: "available",
    lowStock: null,
    details: { material: "", weight: "", care: "", sizeChart: "" },
  };
}

export function productToForm(p: Product): ProductForm {
  const derivedSizes = Array.isArray(p.sizes)
    ? Array.from(new Set(p.sizes))
    : Array.from(new Set((p.variants || []).map((v) => v.size).filter(Boolean)));

  return {
    productId: p.id,
    name: p.name || (p as any).nameAr || "",
    slug: p.slug,
    slugTouched: true,
    description: p.description || (p as any).descriptionAr || "",
    category: p.category,
    price: (p.priceCents || 0) / 100,
    compareAt: p.compareAtCents === null || p.compareAtCents === undefined ? null : p.compareAtCents / 100,
    images: (p.images || []).map((i) => ({ ...i })),
    colors: (p.colors || []).map((c) => ({ ...c })),
    sizes: derivedSizes,
    variants: (p.variants || []).map((v) => ({ ...v })),
    status: p.status === "draft" ? "draft" : p.forceSoldOut ? "sold_out" : "available",
    lowStock: p.lowStockThreshold ?? null,
    details: { ...(p.details || {}) },
  };
}

/** Sizes the form can show: the standard list plus any custom size the product already has. */
export function sizeChoices(form: ProductForm): string[] {
  const safeSizes = Array.isArray(form?.sizes) ? form.sizes : [];
  const baseOptions = form?.category === "pants" ? PANTS_SIZE_OPTIONS : SIZE_OPTIONS;
  const extra = safeSizes.filter((s) => !(baseOptions as readonly string[]).includes(s));
  return Array.from(new Set([...baseOptions, ...extra]));
}

/** Ids stay stable when a colour is renamed, so existing orders keep pointing at the right stock. */
export function nextColorId(colors: ColorOption[]): string {
  const safeColors = Array.isArray(colors) ? colors : [];
  let n = safeColors.length + 1;
  while (safeColors.some((c) => c.id === `color-${n}`)) n += 1;
  return `color-${n}`;
}

function orderSizes(sizes: string[], category?: ProductCategory): string[] {
  const safeSizes = Array.isArray(sizes) ? sizes : [];
  const baseOptions = category === "pants" ? PANTS_SIZE_OPTIONS : SIZE_OPTIONS;
  const rank = (s: string) => {
    const i = (baseOptions as readonly string[]).indexOf(s);
    return i === -1 ? baseOptions.length : i;
  };
  return Array.from(new Set([...safeSizes])).sort((a, b) => rank(a) - rank(b));
}

/** Rebuilds the colour x size grid after colours or sizes change, keeping numbers already typed. */
export function withGrid(form: ProductForm, patch: Partial<Pick<ProductForm, "colors" | "sizes">>): ProductForm {
  const colors = patch.colors ? (Array.isArray(patch.colors) ? patch.colors : []) : (Array.isArray(form?.colors) ? form.colors : []);
  const sizes = patch.sizes ? orderSizes(patch.sizes, form.category) : (Array.isArray(form?.sizes) ? form.sizes : []);
  const safeVariants = Array.isArray(form?.variants) ? form.variants : [];
  return { ...form, colors, sizes, variants: generateVariants(form.productId, colors, sizes, safeVariants) };
}

export function setCellStock(form: ProductForm, variantId: string, stock: number): ProductForm {
  return { ...form, variants: form.variants.map((v) => (v.id === variantId ? { ...v, stock } : v)) };
}

export function formTotalStock(form: ProductForm): number {
  return form.variants.reduce((sum, v) => sum + v.stock, 0);
}

export function toCents(egp: number): number {
  return Math.round(egp * 100);
}

export type FormErrorCode =
  | "NAME_REQUIRED"
  | "SLUG_REQUIRED"
  | "SLUG_FORMAT"
  | "SLUG_TAKEN"
  | "PRICE_REQUIRED"
  | "PRICE_POSITIVE"
  | "COMPARE_TOO_LOW"
  | "LOW_STOCK_INVALID"
  | "COLORS_REQUIRED"
  | "COLOR_NAME_REQUIRED"
  | "COLOR_NAME_DUPLICATE"
  | "COLOR_HEX_INVALID"
  | "SIZES_REQUIRED"
  | "STOCK_INVALID";

export type FormField = "name" | "slug" | "price" | "compareAt" | "lowStock" | "colors" | "sizes" | "stock";
export type FormErrors = Partial<Record<FormField, FormErrorCode>>;

/**
 * Name, slug and price are always required. Colours, sizes and stock are required once the
 * product is not a draft, so a half-finished product can still be saved as a draft.
 */
export function validateForm(form: ProductForm, takenSlugs: string[]): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = "NAME_REQUIRED";

  if (!form.slug.trim()) errors.slug = "SLUG_REQUIRED";
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) errors.slug = "SLUG_FORMAT";
  else if (takenSlugs.includes(form.slug)) errors.slug = "SLUG_TAKEN";

  if (form.price === null) errors.price = "PRICE_REQUIRED";
  else if (!(form.price > 0)) errors.price = "PRICE_POSITIVE";

  if (form.compareAt !== null && form.price !== null && form.compareAt <= form.price) errors.compareAt = "COMPARE_TOO_LOW";

  if (form.lowStock !== null && (!Number.isInteger(form.lowStock) || form.lowStock < 0)) errors.lowStock = "LOW_STOCK_INVALID";

  if (form.status !== "draft") {
    if (form.colors.length === 0) errors.colors = "COLORS_REQUIRED";
    if (form.sizes.length === 0) errors.sizes = "SIZES_REQUIRED";
  }
  const names = new Set<string>();
  for (const c of form.colors) {
    const key = c.name.trim().toLowerCase();
    if (!key) errors.colors = "COLOR_NAME_REQUIRED";
    else if (names.has(key)) errors.colors = "COLOR_NAME_DUPLICATE";
    else if (!/^#[0-9a-fA-F]{6}$/.test(c.hex)) errors.colors = "COLOR_HEX_INVALID";
    names.add(key);
  }
  if (form.variants.some((v) => !Number.isInteger(v.stock) || v.stock < 0)) errors.stock = "STOCK_INVALID";
  return errors;
}

export function isFormEqual(a: ProductForm, b: ProductForm): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Valid forms only (call validateForm first). `publish` turns a draft form into a live product. */
export function formToProduct(form: ProductForm, existing: Product | null, now: string): Product {
  return {
    id: form.productId,
    slug: form.slug.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
    category: form.category,
    priceCents: toCents(form.price ?? 0),
    compareAtCents: form.compareAt === null ? null : toCents(form.compareAt),
    status: form.status === "draft" ? "draft" : "active",
    forceSoldOut: form.status === "sold_out",
    lowStockThreshold: form.lowStock,
    details: {
      material: (form.details.material || "").trim(),
      weight: (form.details.weight || "").trim(),
      care: (form.details.care || "").trim(),
      sizeChart: (form.details.sizeChart || "").trim(),
      look: form.details.look,
    },
    colors: (Array.isArray(form?.colors) ? form.colors : []).map((c) => ({ ...c, name: (c.name || "").trim() })),
    sizes: Array.isArray(form?.sizes) ? [...form.sizes] : [],
    variants: (Array.isArray(form?.variants) ? form.variants : []).map((v) => ({ ...v })),
    images: (Array.isArray(form?.images) ? form.images : []).map((i) => ({ ...i, alt: (i.alt || "").trim() })),
    // The server uses this value to reject an old editor tab instead of letting it
    // overwrite a newer stock/status/price update.
    revision: existing?.revision,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}


