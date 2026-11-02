import type { Metadata } from "next";
import type { ReactNode } from "react";
// Same stylesheet as the admin dashboard: one palette, one type scale, one set of components.
import "../admin/admin.css";

export const metadata: Metadata = {
  title: { default: "بورتال السفير", template: "%s · سفراء الشارع · تيرا هوب" },
  robots: { index: false, follow: false, nocache: true },
};

export default function AmbassadorLayout({ children }: { children: ReactNode }) {
  return children;
}
