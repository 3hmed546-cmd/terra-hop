"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { useLive } from "@/lib/use-live";
import { ComingSoonView } from "./ComingSoonView";
import { Footer } from "@/components/layout/footer";
import { home } from "@/content/home";
import { ADMIN_BASE } from "@/lib/admin/paths";

function GateInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: liveSite } = useLive("settings");

  // Keep admin, secret vault, ambassador, and API routes always accessible
  const isAdmin =
    !pathname ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/admin-login") ||
    (ADMIN_BASE && pathname.startsWith(ADMIN_BASE)) ||
    pathname.includes("vault") ||
    pathname.startsWith("/ambassador") ||
    pathname.startsWith("/api");

  if (isAdmin) {
    return <>{children}</>;
  }

  const comingSoonSetting = liveSite?.settings?.store?.coming_soon;
  const isEnabled = Boolean(comingSoonSetting?.enabled);
  const targetDate = comingSoonSetting?.targetDate || "2026-11-20T00:00:00";
  const title = comingSoonSetting?.title;

  if (isEnabled) {
    return (
      <div className="min-h-screen bg-[#040404] text-off-white flex flex-col justify-between selection:bg-white/20">
        <ComingSoonView targetDate={targetDate} title={title} />
        <Footer footer={home.footer} />
      </div>
    );
  }

  return <>{children}</>;
}

export function StorefrontGate({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<>{children}</>}>
      <GateInner>{children}</GateInner>
    </Suspense>
  );
}
