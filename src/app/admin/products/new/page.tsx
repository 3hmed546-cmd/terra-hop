import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/products/ProductForm";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";

export const metadata: Metadata = { title: ADMIN_STRINGS.productForm.titleNew };

export default function Page() {
  return <ProductForm />;
}
