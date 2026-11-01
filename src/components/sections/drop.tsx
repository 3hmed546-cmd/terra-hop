"use client";

import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { ProductGrid } from "@/components/drop/product-grid";
import { useLocale } from "@/lib/locale-context";
import type { home } from "@/content/home";

export function Drop({ drop }: { drop: typeof home.drop }) {
  const { t } = useLocale();

  return (
    <section aria-labelledby="drop-heading" className="pt-8 pb-16 lg:pt-12 lg:pb-24">
      <Container>
        <Reveal className="flex items-baseline justify-between gap-4">
          <h2 id="drop-heading" className="text-h1">{t.drop.heading}</h2>
          <Link href={drop.viewAll.href} className="text-label min-h-11 py-3 underline underline-offset-4">
            {t.drop.viewAll}
          </Link>
        </Reveal>
        <ProductGrid products={[...drop.products]} />
      </Container>
    </section>
  );
}
