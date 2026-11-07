import type { Metadata } from "next";
import fs from "fs";
import path from "path";
import { PageShell } from "@/components/layout/page-shell";
import { CartView } from "@/components/cart/cart-view";
import { Reveal } from "@/components/motion/reveal";
import { home, type Product } from "@/content/home";

export const metadata: Metadata = {
  title: "سلة التسوق | Cart",
  description: "سلة التسوق الخاصة بك في متجر TERRA HOP",
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
          category: (p.category === "tshirt" || p.category === "T-shirts")
            ? "T-shirts"
            : (p.category === "pants" || p.category === "Pants")
            ? "Pants"
            : "Hoodies",
          price: (p.priceCents || 0) / 100,
          originalPrice: p.compareAtCents ? p.compareAtCents / 100 : undefined,
          status: p.forceSoldOut ? "Sold out" : "Preorder",
          description: p.description || p.descriptionAr || "",
          sizes: Array.isArray(p.sizes) && p.sizes.length > 0
            ? Array.from(new Set(p.sizes))
            : Array.from(new Set((p.variants || []).map((v: any) => v.size).filter(Boolean))),
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

export default function CartPage() {
  const products = getCatalogProducts();
  return (
    <PageShell>
      <Reveal>
        <h1 className="text-h1">سلة التسوق</h1>
      </Reveal>
      <CartView products={products} />
    </PageShell>
  );
}
