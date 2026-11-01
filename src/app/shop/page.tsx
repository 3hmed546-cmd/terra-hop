import type { Metadata } from "next";
import { ShopView } from "@/components/shop/shop-view";
import { home } from "@/content/home";

export const metadata: Metadata = {
  title: "المتجر | Shop",
  description: "تشكيلة منتجات TERRA HOP - Drop 01",
};

export default function ShopPage() {
  return <ShopView products={[...home.drop.products]} />;
}
