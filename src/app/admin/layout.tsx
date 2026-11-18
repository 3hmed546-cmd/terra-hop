import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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
    const secret = (process.env.ADMIN_PATH || process.env.ADMIN_LOGIN_PATH || "k7q2-vault-9xm4").replace(/^\/+|\/+$/g, "");
    redirect(`/${secret}`);
  }

  return <AdminShell>{children}</AdminShell>;
}
