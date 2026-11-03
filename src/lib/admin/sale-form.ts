/** Pure state and validation for the Record a sale form. */
import { reservedQuantities } from "./inventory";
import { toCents } from "./product-form";
import type { ManualSaleInput } from "./inventory";
import type { AdminData, Product, Variant } from "./types";

export interface SaleForm {
  productId: string;
  colorId: string;
  size: string;
  qty: number | null;
  /** EGP, as typed (decimals allowed) */
  price: number | null;
  buyer: string;
  note: string;
}

export type SaleField = "product" | "color" | "size" | "qty" | "price";
export type SaleErrorCode = "product" | "color" | "size" | "qty" | "qtyTooMany" | "price";

const totalStock = (p: Product): number => p.variants.reduce((s, v) => s + v.stock, 0);

/** Any product with pieces left can be sold by hand (even a draft that is not on the website). */
export function sellableProducts(data: AdminData): Product[] {
  return data.products.filter((p) => totalStock(p) > 0);
}

export function firstInStockVariant(product: Product, colorId?: string): Variant | null {
  return product.variants.find((v) => v.stock > 0 && (colorId === undefined || v.colorId === colorId)) ?? null;
}

function formFor(product: Product, current?: Pick<SaleForm, "qty" | "buyer" | "note">): SaleForm {
  const v = firstInStockVariant(product);
  return {
    productId: product.id,
    colorId: v?.colorId ?? "",
    size: v?.size ?? "",
    qty: current?.qty ?? 1,
    price: product.priceCents / 100,
    buyer: current?.buyer ?? "",
    note: current?.note ?? "",
  };
}

export function initialSaleForm(data: AdminData): SaleForm {
  const first = sellableProducts(data)[0];
  return first
    ? formFor(first)
    : { productId: "", colorId: "", size: "", qty: 1, price: null, buyer: "", note: "" };
}

/** Switching product picks the first colour and size in stock and resets the price to the product's. */
export function changeProduct(data: AdminData, form: SaleForm, productId: string): SaleForm {
  const product = data.products.find((p) => p.id === productId);
  return product ? formFor(product, form) : { ...form, productId, colorId: "", size: "" };
}

/** Switching colour keeps the size when that colour has it in stock, else picks one that is. */
export function changeColor(data: AdminData, form: SaleForm, colorId: string): SaleForm {
  const product = data.products.find((p) => p.id === form.productId);
  if (!product) return { ...form, colorId };
  const same = product.variants.find((v) => v.colorId === colorId && v.size === form.size && v.stock > 0);
  return { ...form, colorId, size: same ? same.size : (firstInStockVariant(product, colorId)?.size ?? form.size) };
}

export function variantOfForm(data: AdminData, form: SaleForm): Variant | null {
  const product = data.products.find((p) => p.id === form.productId);
  return product?.variants.find((v) => v.colorId === form.colorId && v.size === form.size) ?? null;
}

export interface SaleAvailability {
  inStock: number;
  held: number;
  afterSale: number;
  /** the sale is possible but takes pieces held for orders waiting for a decision */
  usesHeld: boolean;
}

export function saleAvailability(data: AdminData, form: SaleForm): SaleAvailability | null {
  const variant = variantOfForm(data, form);
  if (!variant) return null;
  const held = Math.min(reservedQuantities(data).get(variant.id) ?? 0, variant.stock);
  const qty = form.qty ?? 0;
  return {
    inStock: variant.stock,
    held,
    afterSale: variant.stock - qty,
    usesHeld: held > 0 && qty > variant.stock - held && qty <= variant.stock,
  };
}

export function validateSale(data: AdminData, form: SaleForm): Partial<Record<SaleField, SaleErrorCode>> {
  const errors: Partial<Record<SaleField, SaleErrorCode>> = {};
  const product = data.products.find((p) => p.id === form.productId);
  if (!product) {
    errors.product = "product";
    return errors;
  }
  if (!Array.isArray(product.colors) || !product.colors.some((c) => c.id === form.colorId)) errors.color = "color";
  if (!Array.isArray(product.sizes) || !product.sizes.includes(form.size)) errors.size = "size";
  const variant = variantOfForm(data, form);
  if (form.qty === null || !Number.isInteger(form.qty) || form.qty < 1) errors.qty = "qty";
  else if (variant && form.qty > variant.stock) errors.qty = "qtyTooMany";
  if (form.price === null || !Number.isFinite(form.price) || form.price < 0) errors.price = "price";
  return errors;
}

export function toSaleInput(form: SaleForm, variantId: string): ManualSaleInput {
  return {
    variantId,
    qty: form.qty ?? 0,
    unitPriceCents: toCents(form.price ?? 0),
    buyerName: form.buyer.trim() || undefined,
    note: form.note.trim() || undefined,
  };
}

export function saleTotalCents(form: SaleForm): number {
  return toCents(form.price ?? 0) * (form.qty ?? 0);
}
