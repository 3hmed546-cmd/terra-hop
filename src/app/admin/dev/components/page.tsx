import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComponentsPreview } from "@/components/admin/ComponentsPreview";

export const metadata: Metadata = { title: "Components" };

export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ComponentsPreview />;
}
