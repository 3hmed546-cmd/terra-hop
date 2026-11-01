import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { home } from "@/content/home";

export const metadata: Metadata = {
  title: "إتمام الطلب | Checkout",
  description: "إتمام الطلب وتأكيد الشحن مع الدفع عند الاستلام والمعاينة - TERRA HOP",
};

export default function CheckoutPage() {
  return (
    <PageShell>
      <CheckoutView products={[...home.drop.products]} />
    </PageShell>
  );
}
