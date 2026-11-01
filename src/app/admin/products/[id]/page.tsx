import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/products/ProductForm";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";

export const metadata: Metadata = { title: ADMIN_STRINGS.productForm.titleEdit };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductForm productId={id} />;
}
