import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { ProductDetailView } from "@/components/shop/product-detail-view";
import { home } from "@/content/home";

const find = (slug: string) => home.drop.products.find((p) => p.slug === slug);

export function generateStaticParams() {
  return home.drop.products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/shop/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = find(slug);
  return product ? { title: product.name, description: product.description } : {};
}

function ProductLoadingFallback() {
  return (
    <PageShell>
      <div className="min-h-[50vh] flex items-center justify-center text-graphite text-sm animate-pulse">
        جاري تحميل تفاصيل المنتج...
      </div>
    </PageShell>
  );
}

async function ProductContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = find(slug);
  if (!product) notFound();
  return <ProductDetailView product={product} allProducts={home.drop.products} />;
}

export default function ProductPage({ params }: PageProps<"/shop/[slug]">) {
  return (
    <Suspense fallback={<ProductLoadingFallback />}>
      <ProductContent params={params} />
    </Suspense>
  );
}
