/** Admin domain types. Money is always an integer number of piastres (cents). */

export type ProductCategory = "tshirt" | "hoodie" | "other";
/** Stored status. "Sold out" is derived (see inventory.deriveProductStatus). */
export type ProductStatus = "active" | "draft";
export type DerivedProductStatus = "available" | "low" | "sold_out" | "draft";

export interface ColorOption {
  id: string;
  name: string;
  hex: string;
  image?: string;
  imageUrl?: string;
}

export interface Variant {
  id: string;
  colorId: string;
  size: string;
  stock: number;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
}

export interface ProductDetails {
  material: string;
  weight: string;
  care: string;
  sizeChart: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: ProductCategory;
  priceCents: number;
  compareAtCents: number | null;
  status: ProductStatus;
  forceSoldOut: boolean;
  /** null = use the store default from settings */
  lowStockThreshold: number | null;
  details: ProductDetails;
  colors: ColorOption[];
  sizes: string[];
  variants: Variant[];
  images: ProductImage[];
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus =
  | "PENDING_EMAIL"
  | "AWAITING_APPROVAL"
  | "SOLD"
  | "CANCELLED"
  | "EXPIRED";
export type OrderSource = "website" | "manual";

export interface OrderItem {
  productId: string;
  variantId: string;
  productName: string;
  colorName: string;
  size: string;
  qty: number;
  priceCentsSnapshot: number;
}

export interface Customer {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
}

export type TimelineType =
  | "placed"
  | "email_confirmed"
  | "expired"
  | "sold"
  | "cancelled"
  | "manual_sale";

export interface TimelineEvent {
  at: string;
  type: TimelineType;
  actor: "customer" | "owner" | "system";
  note?: string;
}

export interface Order {
  id: string;
  /** Display number, e.g. TH-1042 */
  number: string;
  source: OrderSource;
  status: OrderStatus;
  customer: Customer;
  notes: string;
  items: OrderItem[];
  shippingCents: number;
  totalCents: number;
  createdAt: string;
  emailConfirmedAt: string | null;
  soldAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  timeline: TimelineEvent[];
  ambassadorId?: string | null;
  ambassadorCode?: string | null;
  fulfilmentStatus?: "NOT_SHIPPED" | "SHIPPED" | "DELIVERED" | "RETURNED" | "DELIVERY_FAILED";
  paymentStatus?: "UNPAID" | "PAID" | "REFUNDED";
  deliveredAt?: string | null;
  paidAt?: string | null;
  courierReference?: string | null;
  discountCents?: number;
  subtotalCents?: number;
}

export type StockReason = "sale" | "cancel_restock" | "manual_adjust" | "initial";

export interface StockMovement {
  id: string;
  variantId: string;
  productId: string;
  delta: number;
  before: number;
  after: number;
  reason: StockReason;
  orderId: string | null;
  note: string | null;
  createdAt: string;
}

export interface Settings {
  storeName: string;
  currency: "EGP";
  shippingCents: number;
  lowStockThreshold: number;
  reservation: "none" | "hold";
  emailTokenHours: number;
  /** How long a login lasts. Preview only until real sessions arrive (B1). */
  sessionHours: number;
  /** Single-key keyboard shortcuts (WCAG 2.1.4: must be possible to turn off). */
  shortcuts: boolean;
}

export interface AdminData {
  products: Product[];
  orders: Order[];
  movements: StockMovement[];
  settings: Settings;
}

export type ErrorCode =
  | "ORDER_NOT_FOUND"
  | "ORDER_NOT_AWAITING"
  | "ORDER_ALREADY_CLOSED"
  | "PRODUCT_NOT_FOUND"
  | "VARIANT_NOT_FOUND"
  | "INSUFFICIENT_STOCK"
  | "INVALID_QUANTITY"
  | "INVALID_PRICE"
  | "NO_STOCK"
  | "SLUG_TAKEN"
  | "NOTHING_TO_ORDER"
  | "ORDER_NOT_PENDING_EMAIL"
  | "NO_CHANGE";

export type Result<T> = { ok: true; data: T } | { ok: false; error: ErrorCode };
