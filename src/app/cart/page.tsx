import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { CartView } from "@/components/cart/cart-view";
import { Reveal } from "@/components/motion/reveal";
import { home } from "@/content/home";

export const metadata: Metadata = {
  title: "سلة التسوق | Cart",
  description: "سلة التسوق الخاصة بك في متجر TERRA HOP",
};

export default function CartPage() {
  return (
    <PageShell>
      <Reveal>
        <h1 className="text-h1">سلة التسوق</h1>
      </Reveal>
      <CartView products={[...home.drop.products]} />
    </PageShell>
  );
}
