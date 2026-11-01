/**
 * Demo data. Built by running the real business functions (initial stock, sales,
 * cancellations) so stock levels and the stock log always agree.
 */
import { slugify } from "./format";
import {
  cancelOrder,
  changeStock,
  colorName,
  generateVariants,
  nextOrderNumber,
  orderSubtotal,
  recordManualSale,
  sellOrder,
} from "./inventory";
import type {
  AdminData,
  ColorOption,
  Customer,
  Order,
  OrderItem,
  Product,
  ProductCategory,
  Settings,
} from "./types";

export const DEFAULT_SETTINGS: Settings = {
  storeName: "Terra Hop",
  currency: "EGP",
  shippingCents: 6000,
  lowStockThreshold: 3,
  reservation: "none",
  emailTokenHours: 24,
  sessionHours: 24,
  shortcuts: true,
};

const BLACK: ColorOption = { id: "black", name: "Black", hex: "#080808" };
const BONE: ColorOption = { id: "off-white", name: "Off-White", hex: "#F4F1EB" };
const STONE: ColorOption = { id: "stone", name: "Washed Grey", hex: "#6E6E6E" };
const OLIVE: ColorOption = { id: "olive", name: "Forest Green", hex: "#2E3B2E" };
const BLUE: ColorOption = { id: "dusty-blue", name: "Dusty Blue", hex: "#34445C" };
const BROWN: ColorOption = { id: "chocolate", name: "Vintage Brown", hex: "#4A3B30" };
const TEAL: ColorOption = { id: "deep-teal", name: "Deep Teal", hex: "#1D3A44" };
const CHARCOAL: ColorOption = { id: "charcoal", name: "Charcoal", hex: "#232323" };
const NAVY: ColorOption = { id: "slate-navy", name: "Slate Navy", hex: "#1A2744" };
const BEIGE: ColorOption = { id: "sand-beige", name: "Sand Beige", hex: "#E3D8C8" };

interface ProductSpec {
  id: string;
  name: string;
  category: ProductCategory;
  priceEgp: number;
  compareAtEgp?: number;
  status?: "active" | "draft";
  forceSoldOut?: boolean;
  colors: ColorOption[];
  sizes: string[];
  /** grid[colorIndex][sizeIndex] = initial stock */
  grid: number[][];
  description: string;
  material: string;
  createdAt: string;
}

export function getProductDefaultImage(id: string): string {
  if (id.includes("dusty-blue")) return "/login-hoodies/hoodie-dusty-blue.webp";
  if (id.includes("off-white") && id.includes("hoodie")) return "/login-hoodies/hoodie-offwhite.webp";
  if (id.includes("chocolate") || id.includes("vintage-brown")) return "/login-hoodies/hoodie-chocolate.webp";
  if (id.includes("forest")) return "/login-hoodies/hoodie-forest.webp";
  if (id.includes("deep-teal")) return "/login-hoodies/hoodie-deep-teal.webp";
  if (id.includes("washed-black")) return "/login-hoodies/hoodie-washed-black.webp";
  if (id.includes("charcoal")) return "/login-hoodies/hoodie-charcoal.webp";
  if (id.includes("slate-navy") || id.includes("navy")) return "/login-hoodies/hoodie-slate-navy.webp";
  if (id.includes("sand-beige") || id.includes("beige")) return "/login-hoodies/hoodie-sand-beige.webp";
  if (id.includes("hoodie")) return "/login-hoodies/hoodie-black.webp";
  if (id.includes("off-white")) return "/preview-images/tee-offwhite-1.jpg";
  if (id.includes("grey")) return "/preview-images/tee-grey-1.jpg";
  return "/preview-images/tee-black-1.jpg";
}

const PRODUCTS: ProductSpec[] = [
  // 10 Streetwear Hoodies
  {
    id: "black-oversized-hoodie",
    name: "Obsidian Black Oversized Hoodie",
    category: "hoodie",
    priceEgp: 1200,
    compareAtEgp: 1500,
    colors: [BLACK],
    sizes: ["S", "M", "L", "XL", "XXL"],
    grid: [[10, 18, 24, 16, 6]],
    description: "Thick brushed cotton fleece, deep double-layer hood, kangaroo pocket, and high-density chest logo embroidery.",
    material: "100% heavy cotton fleece, 420 gsm",
    createdAt: "2026-09-01T10:00:00.000Z",
  },
  {
    id: "dusty-blue-hoodie",
    name: "Dusty Blue Oversized Hoodie",
    category: "hoodie",
    priceEgp: 1150,
    compareAtEgp: 1450,
    colors: [BLUE],
    sizes: ["S", "M", "L", "XL", "XXL"],
    grid: [[8, 14, 20, 12, 4]],
    description: "Relaxed streetwear oversized cut in dusty blue tone with signature planet embroidery on chest.",
    material: "100% combed cotton fleece, 420 gsm",
    createdAt: "2026-09-02T10:00:00.000Z",
  },
  {
    id: "off-white-hoodie",
    name: "Off-White Minimalist Hoodie",
    category: "hoodie",
    priceEgp: 1100,
    compareAtEgp: 1400,
    colors: [BONE],
    sizes: ["S", "M", "L", "XL", "XXL"],
    grid: [[6, 12, 16, 10, 4]],
    description: "Clean minimalist off-white aesthetic with dropped shoulders and thick ribbed cuffs.",
    material: "100% heavy cotton fleece, 420 gsm",
    createdAt: "2026-09-03T10:00:00.000Z",
  },
  {
    id: "vintage-brown-hoodie",
    name: "Chocolate Brown Vintage Hoodie",
    category: "hoodie",
    priceEgp: 1150,
    compareAtEgp: 1450,
    colors: [BROWN],
    sizes: ["S", "M", "L", "XL", "XXL"],
    grid: [[7, 15, 18, 11, 5]],
    description: "Earthy vintage chocolate brown tone with high-density premium chest embroidery.",
    material: "100% heavy cotton fleece, 420 gsm",
    createdAt: "2026-09-04T10:00:00.000Z",
  },
  {
    id: "deep-teal-hoodie",
    name: "Deep Teal Oversized Hoodie",
    category: "hoodie",
    priceEgp: 1150,
    compareAtEgp: 1450,
    colors: [TEAL],
    sizes: ["S", "M", "L", "XL", "XXL"],
    grid: [[5, 11, 15, 8, 3]],
    description: "Rich deep teal streetwear hoodie crafted for comfort and modern aesthetic.",
    material: "100% heavy cotton fleece, 420 gsm",
    createdAt: "2026-09-05T10:00:00.000Z",
  },
  {
    id: "forest-green-hoodie",
    name: "Forest Green Oversized Hoodie",
    category: "hoodie",
    priceEgp: 1200,
    compareAtEgp: 1500,
    colors: [OLIVE],
    sizes: ["S", "M", "L", "XL", "XXL"],
    grid: [[6, 13, 19, 10, 4]],
    description: "Deep forest green streetwear hoodie with contrast white TERRA HOP chest logo.",
    material: "100% heavy cotton fleece, 420 gsm",
    createdAt: "2026-09-06T10:00:00.000Z",
  },
  {
    id: "washed-black-hoodie",
    name: "Washed Black Streetwear Hoodie",
    category: "hoodie",
    priceEgp: 1180,
    compareAtEgp: 1480,
    colors: [CHARCOAL],
    sizes: ["S", "M", "L", "XL", "XXL"],
    grid: [[8, 16, 22, 14, 5]],
    description: "Acid washed vintage black treatment with soft brushed interior and relaxed draping.",
    material: "100% heavy cotton fleece, 420 gsm",
    createdAt: "2026-09-07T10:00:00.000Z",
  },
  {
    id: "charcoal-hoodie",
    name: "Charcoal Heather Heavyweight Hoodie",
    category: "hoodie",
    priceEgp: 1120,
    compareAtEgp: 1420,
    colors: [STONE],
    sizes: ["S", "M", "L", "XL", "XXL"],
    grid: [[6, 12, 17, 9, 3]],
    description: "Medium charcoal heather hoodie with durable flatlock stitching and chest branding.",
    material: "100% heavy cotton fleece, 420 gsm",
    createdAt: "2026-09-08T10:00:00.000Z",
  },
  {
    id: "slate-navy-hoodie",
    name: "Slate Navy Heavyweight Hoodie",
    category: "hoodie",
    priceEgp: 1250,
    compareAtEgp: 1550,
    colors: [NAVY],
    sizes: ["S", "M", "L", "XL", "XXL"],
    grid: [[7, 14, 20, 12, 4]],
    description: "Royal slate navy oversized cut with double fleece hood and custom silver hardware.",
    material: "100% heavy combed cotton, 440 gsm",
    createdAt: "2026-09-09T10:00:00.000Z",
  },
  {
    id: "sand-beige-hoodie",
    name: "Sand Beige Heavyweight Hoodie",
    category: "hoodie",
    priceEgp: 1100,
    compareAtEgp: 1400,
    colors: [BEIGE],
    sizes: ["S", "M", "L", "XL", "XXL"],
    grid: [[5, 10, 15, 8, 3]],
    description: "Desert sand tone hoodie with warm tonal embroidery and ribbed side panels.",
    material: "100% heavy cotton fleece, 420 gsm",
    createdAt: "2026-09-10T10:00:00.000Z",
  },

  // 3 Oversized Tees
  {
    id: "black-oversized-tee",
    name: "Black Oversized Tee",
    category: "tshirt",
    priceEgp: 650,
    compareAtEgp: 850,
    colors: [BLACK],
    sizes: ["S", "M", "L", "XL", "XXL"],
    grid: [[6, 12, 16, 10, 4]],
    description: "Heavy cotton jersey, dropped shoulders and a boxy oversized cut. A small chest logo and nothing else.",
    material: "100% combed cotton, 260 gsm",
    createdAt: "2026-09-10T10:00:00.000Z",
  },
  {
    id: "off-white-graphic-tee",
    name: "Off-White Graphic Tee",
    category: "tshirt",
    priceEgp: 650,
    compareAtEgp: 850,
    colors: [BONE],
    sizes: ["S", "M", "L", "XL", "XXL"],
    grid: [[5, 10, 14, 8, 3]],
    description: "Soft off-white cotton with a relaxed oversized fit. Made to be worn loose over everything.",
    material: "100% combed cotton, 240 gsm",
    createdAt: "2026-09-10T10:05:00.000Z",
  },
  {
    id: "washed-grey-tee",
    name: "Washed Grey Tee",
    category: "tshirt",
    priceEgp: 600,
    compareAtEgp: 750,
    colors: [STONE],
    sizes: ["S", "M", "L", "XL", "XXL"],
    grid: [[4, 8, 12, 6, 2]],
    description: "A washed grey tee with a lived-in feel from the first day. Oversized cut, soft hand.",
    material: "100% cotton, 240 gsm",
    createdAt: "2026-09-11T10:00:00.000Z",
  },
];

type FinalState = "SOLD" | "SOLD_THEN_CANCELLED" | "CANCELLED" | "EXPIRED" | "PENDING_EMAIL" | "AWAITING_APPROVAL";

interface OrderSpec {
  created: string;
  customer: Customer;
  /** [productId, colorId, size, qty] */
  items: [string, string, string, number][];
  final: FinalState;
  /** minutes after placing that the email was confirmed (omit for never) */
  confirmedAfterMin?: number;
  decidedAt?: string;
  cancelledAt?: string;
  reason?: string;
  notes?: string;
}

const C = (name: string, phone: string, email: string, address: string, city: string): Customer => ({
  name, phone, email, address, city,
});

const ORDERS: OrderSpec[] = [
  { created: "2026-10-20T16:05:00.000Z", final: "SOLD", confirmedAfterMin: 2, decidedAt: "2026-10-21T08:00:00.000Z",
    customer: C("Mona S.", "0100 000 0001", "mona@example.com", "12 Street, Maadi", "Cairo"),
    items: [["black-oversized-hoodie", "black", "XL", 1], ["black-oversized-tee", "black", "L", 1]] },
  { created: "2026-10-22T12:20:00.000Z", final: "SOLD", confirmedAfterMin: 5, decidedAt: "2026-10-22T15:00:00.000Z",
    customer: C("Karim A.", "0100 000 0002", "karim@example.com", "4 Corniche Road", "Alexandria"),
    items: [["washed-grey-tee", "stone", "M", 2]] },
  // 1003 is a manual sale, added in code below
  { created: "2026-10-24T09:10:00.000Z", final: "CANCELLED", confirmedAfterMin: 3, cancelledAt: "2026-10-24T11:00:00.000Z",
    reason: "Customer asked to cancel",
    customer: C("Salma H.", "0100 000 0004", "salma@example.com", "7 Garden City", "Cairo"),
    items: [["dusty-blue-hoodie", "dusty-blue", "M", 1]] },
  { created: "2026-10-25T14:30:00.000Z", final: "SOLD_THEN_CANCELLED", confirmedAfterMin: 4,
    decidedAt: "2026-10-25T18:00:00.000Z", cancelledAt: "2026-10-26T10:30:00.000Z", reason: "Returned: wrong size",
    customer: C("Omar Y.", "0100 000 0005", "omar@example.com", "21 Nasr City St", "Cairo"),
    items: [["off-white-graphic-tee", "off-white", "M", 1]] },
  { created: "2026-10-26T20:00:00.000Z", final: "EXPIRED", cancelledAt: "2026-10-27T20:00:00.000Z",
    customer: C("Nour E.", "0100 000 0006", "nour@example.com", "9 Haram St", "Giza"),
    items: [["washed-grey-tee", "stone", "S", 1]] },
  { created: "2026-10-27T11:15:00.000Z", final: "SOLD", confirmedAfterMin: 6, decidedAt: "2026-10-28T09:00:00.000Z",
    customer: C("Youssef T.", "0100 000 0007", "youssef@example.com", "3 Mohandessin St", "Giza"),
    items: [["black-oversized-hoodie", "black", "L", 1]] },
  { created: "2026-10-28T17:45:00.000Z", final: "AWAITING_APPROVAL", confirmedAfterMin: 2,
    customer: C("Hana F.", "0100 000 0008", "hana@example.com", "15 Zamalek St", "Cairo"),
    items: [["forest-green-hoodie", "olive", "M", 1], ["black-oversized-tee", "black", "S", 1]] },
  { created: "2026-10-29T16:30:00.000Z", final: "AWAITING_APPROVAL", confirmedAfterMin: 3,
    customer: C("Laila R.", "0100 000 0009", "laila@example.com", "28 Heliopolis Ave", "Cairo"),
    items: [["vintage-brown-hoodie", "chocolate", "L", 1]] },
  { created: "2026-10-29T18:40:00.000Z", final: "PENDING_EMAIL",
    customer: C("Adam K.", "0100 000 0010", "adam@example.com", "6 Sheikh Zayed", "Giza"),
    items: [["black-oversized-hoodie", "black", "L", 1]] },
  { created: "2026-10-29T19:05:00.000Z", final: "PENDING_EMAIL",
    customer: C("Dina W.", "0100 000 0011", "dina@example.com", "40 Smouha", "Alexandria"),
    items: [["black-oversized-tee", "black", "S", 2]] },
  { created: "2026-10-29T19:14:00.000Z", final: "AWAITING_APPROVAL", confirmedAfterMin: 2,
    customer: C("Ahmed M.", "010 0000 0012", "ahmed@example.com", "12 Street, Nasr City", "Cairo"),
    items: [["black-oversized-tee", "black", "L", 2], ["dusty-blue-hoodie", "dusty-blue", "M", 1]],
    notes: "Please call before delivery." },
  { created: "2026-11-01T08:30:00.000Z", final: "AWAITING_APPROVAL", confirmedAfterMin: 1,
    customer: C("زياد محمود", "01012345678", "ziad@example.com", "التجمع الخامس، كمبوند هايد بارك، فيلا 12", "القاهرة"),
    items: [["dusty-blue-hoodie", "dusty-blue", "L", 1]],
    notes: "برجاء الاتصال قبل الموعد بنصف ساعة" },
  { created: "2026-11-01T08:45:00.000Z", final: "AWAITING_APPROVAL", confirmedAfterMin: 1,
    customer: C("ندى الشريف", "01123456789", "nada@example.com", "الشيخ زايد، بيفرلي هيلز، عمارة 4B شقة 10", "الجيزة"),
    items: [["black-oversized-hoodie", "black", "M", 1], ["off-white-hoodie", "off-white", "S", 1]],
    notes: "الدفع كاش عند الاستلام والمعاينة" },
  { created: "2026-11-01T09:10:00.000Z", final: "AWAITING_APPROVAL", confirmedAfterMin: 2,
    customer: C("كريم عبد العزيز", "01234567890", "karim.a@example.com", "لوران، شارع الإقبال، برج الفيروز، الدور 4", "الإسكندرية"),
    items: [["vintage-brown-hoodie", "chocolate", "XL", 1]],
    notes: "ميعاد التسليم المفضل بعد الساعة 4 عصراً" },
  { created: "2026-11-01T09:20:00.000Z", final: "AWAITING_APPROVAL", confirmedAfterMin: 1,
    customer: C("عمر المهندس", "01555544433", "omar.eng@example.com", "شارع المشاية السفلية، أمام نادي الحوار", "الدقهلية"),
    items: [["forest-green-hoodie", "olive", "L", 2]],
    notes: "هدية عيد ميلاد، برجاء الاهتمام بالتغليف الفاخر" },
  { created: "2026-11-01T09:35:00.000Z", final: "AWAITING_APPROVAL", confirmedAfterMin: 1,
    customer: C("ياسمين طارق", "01099887766", "yasmine@example.com", "المعادي، شارع 9، عمارة 77، شقة 5", "القاهرة"),
    items: [["washed-black-hoodie", "charcoal", "M", 1]],
    notes: "أرجو التأكد من المقاس قبل الشحن" },
];

function buildProducts(): Product[] {
  return PRODUCTS.map((s) => {
    const base: Product = {
      id: s.id, slug: slugify(s.name), name: s.name, description: s.description, category: s.category,
      priceCents: s.priceEgp * 100, compareAtCents: s.compareAtEgp ? s.compareAtEgp * 100 : null,
      status: s.status ?? "active", forceSoldOut: s.forceSoldOut ?? false, lowStockThreshold: null,
      details: { material: s.material, weight: "", care: "Machine wash cold, inside out", sizeChart: "" },
      colors: s.colors, sizes: s.sizes, variants: [], images: [{ id: `img_${s.id}`, url: getProductDefaultImage(s.id), alt: s.name }],
      createdAt: s.createdAt, updatedAt: s.createdAt,
    };
    return { ...base, variants: generateVariants(s.id, s.colors, s.sizes) };
  });
}

function mustOk(r: { ok: true; data: AdminData } | { ok: false; error: string }, ctx: string): AdminData {
  if (!r.ok) throw new Error(`Seed failed (${ctx}): ${r.error}`);
  return r.data;
}

function placeOrder(data: AdminData, spec: OrderSpec): AdminData {
  const number = nextOrderNumber(data.orders);
  const items: OrderItem[] = spec.items.map(([pid, cid, size, qty]) => {
    const product = data.products.find((p) => p.id === pid)!;
    const variant = product.variants.find((v) => v.colorId === cid && v.size === size)!;
    return {
      productId: pid, variantId: variant.id, productName: product.name,
      colorName: colorName(product, cid), size, qty, priceCentsSnapshot: product.priceCents,
    };
  });
  const confirmedAt = spec.confirmedAfterMin !== undefined
    ? new Date(new Date(spec.created).getTime() + spec.confirmedAfterMin * 60_000).toISOString()
    : null;
  const subtotal = orderSubtotal(items);
  const order: Order = {
    id: `ord_${number.slice(3)}`, number, source: "website",
    status: confirmedAt ? "AWAITING_APPROVAL" : "PENDING_EMAIL",
    customer: spec.customer, notes: spec.notes ?? "", items,
    shippingCents: data.settings.shippingCents, totalCents: subtotal + data.settings.shippingCents,
    createdAt: spec.created, emailConfirmedAt: confirmedAt, soldAt: null, cancelledAt: null, cancelReason: null,
    timeline: [
      { at: spec.created, type: "placed", actor: "customer" },
      ...(confirmedAt ? [{ at: confirmedAt, type: "email_confirmed" as const, actor: "customer" as const }] : []),
    ],
  };
  return { ...data, orders: [...data.orders, order] };
}

export function createSeedData(): AdminData {
  let data: AdminData = { products: buildProducts(), orders: [], movements: [], settings: { ...DEFAULT_SETTINGS } };

  // Opening stock
  PRODUCTS.forEach((spec) => {
    spec.colors.forEach((color, ci) => {
      spec.sizes.forEach((size, si) => {
        const qty = spec.grid[ci][si];
        if (qty === 0) return;
        const vid = data.products.find((p) => p.id === spec.id)!
          .variants.find((v) => v.colorId === color.id && v.size === size)!.id;
        data = mustOk(changeStock(data, vid, qty, { reason: "initial", note: "Opening stock" }, "2026-10-01T08:00:00.000Z"), "initial");
      });
    });
  });

  const manualAt = "2026-10-23T13:00:00.000Z";
  ORDERS.forEach((spec, index) => {
    // keep order numbers chronological: TH-1003 is the manual sale
    if (index === 2) {
      const zip = data.products.find((p) => p.id === "black-oversized-hoodie")!.variants.find((v) => v.size === "M")!;
      data = mustOk(
        recordManualSale(data, { variantId: zip.id, qty: 1, unitPriceCents: 110000, buyerName: "Pop-up visitor", note: "Sold at the pop-up" }, manualAt),
        "manual",
      );
    }
    data = placeOrder(data, spec);
    const id = data.orders[data.orders.length - 1].id;
    switch (spec.final) {
      case "SOLD":
        data = mustOk(sellOrder(data, id, spec.decidedAt!), `sell ${id}`);
        break;
      case "SOLD_THEN_CANCELLED":
        data = mustOk(sellOrder(data, id, spec.decidedAt!), `sell ${id}`);
        data = mustOk(cancelOrder(data, id, spec.reason ?? "", spec.cancelledAt!), `cancel ${id}`);
        break;
      case "CANCELLED":
        data = mustOk(cancelOrder(data, id, spec.reason ?? "", spec.cancelledAt!), `cancel ${id}`);
        break;
      case "EXPIRED":
        data = {
          ...data,
          orders: data.orders.map((o) =>
            o.id === id
              ? { ...o, status: "EXPIRED", cancelledAt: spec.cancelledAt!, timeline: [...o.timeline, { at: spec.cancelledAt!, type: "expired", actor: "system" }] }
              : o,
          ),
        };
        break;
      default:
        break;
    }
  });
  return data;
}
