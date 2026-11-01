import type { Metadata } from "next";
import { ProductsList } from "@/components/admin/products/ProductsList";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";

export const metadata: Metadata = { title: ADMIN_STRINGS.pages.products.title };

export default function Page() {
  return <ProductsList />;
}
