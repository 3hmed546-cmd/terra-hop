import type { Metadata } from "next";
import fs from "fs";
import path from "path";
import { PageShell } from "@/components/layout/page-shell";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { home, type Product } from "@/content/home";

export const metadata: Metadata = {
  title: "إتمام الطلب | Checkout",
  description: "إتمام الطلب وتأكيد الشحن مع الدفع عند الاستلام والمعاينة - TERRA HOP",
};

function getCatalogProducts(): Product[] {
  try {
    const vaultPath = path.join(process.cwd(), "data", "secure-vault", "products-data.json");
    if (fs.existsSync(vaultPath)) {
      const raw = JSON.parse(fs.readFileSync(vaultPath, "utf-8"));
      if (Array.isArray(raw) && raw.length > 0) {
        return raw.map((p: any) => ({
          slug: p.slug,
          name: p.name || p.nameAr,
          category: (p.category === "tshirt" || p.category === "T-shirts") ? "T-shirts" : "Hoodies",
          price: (p.priceCents || 0) / 100,
          originalPrice: p.compareAtCents ? p.compareAtCents / 100 : undefined,
          status: p.forceSoldOut ? "Sold out" : "Preorder",
          description: p.description || p.descriptionAr || "",
          sizes: p.sizes || (p.variants || []).map((v: any) => v.size).filter(Boolean),
          images: (p.images || []).map((i: any) => (typeof i === "object" ? i.url : i)),
          colors: p.colors || [],
          variants: p.variants || [],
          href: `/shop/${p.slug}`,
          demo: false,
        }));
      }
    }
  } catch {}
  return [...home.drop.products];
}

export default function CheckoutPage() {
  const products = getCatalogProducts();
  return (
    <PageShell>
      <CheckoutView products={products} />
    </PageShell>
  );
}
