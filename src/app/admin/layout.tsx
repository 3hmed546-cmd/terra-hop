import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { verifySessionToken } from "@/lib/server/security";
import { AdminShell } from "@/components/admin/AdminShell";
import "./admin.css";

export const metadata: Metadata = {
  title: { default: "لوحة التحكم", template: "%s · لوحة تحكم تيرا هوب" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("terra_admin_session")?.value;
  const isAuthed = verifySessionToken(sessionCookie).valid;

  if (!isAuthed) {
    notFound();
  }

  return (
    <Suspense fallback={null}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
