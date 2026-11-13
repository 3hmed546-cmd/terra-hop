"use client";

import { usePathname } from "next/navigation";
import { useLive } from "@/lib/use-live";
import { ComingSoonView } from "./ComingSoonView";
import { Footer } from "@/components/layout/footer";
import { home } from "@/content/home";
import { ADMIN_BASE } from "@/lib/admin/paths";
import type { ComingSoonSetting } from "@/lib/server/coming-soon";

interface StorefrontGateClientProps {
  children: React.ReactNode;
  initialSetting: ComingSoonSetting;
  initialIsAdmin?: boolean;
}

export function StorefrontGateClient({
  children,
  initialSetting,
  initialIsAdmin = false,
}: StorefrontGateClientProps) {
  const pathname = usePathname();
  const { data: liveSite } = useLive("settings");

  // Keep admin, secret vault, ambassador, and API routes always accessible
  const isAdmin =
    initialIsAdmin ||
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

  // Live real-time settings via SSE take priority if loaded,
  // with instant fallback to server-evaluated initialSetting during hydration
  const liveComingSoon = liveSite?.settings?.store?.coming_soon;
  const isEnabled =
    liveComingSoon !== undefined
      ? Boolean(liveComingSoon?.enabled)
      : Boolean(initialSetting.enabled);

  const targetDate =
    liveComingSoon?.targetDate || initialSetting.targetDate || "2026-11-20T00:00:00";
  const title = liveComingSoon?.title || initialSetting.title;
  const imageUrl = liveComingSoon?.imageUrl || initialSetting.imageUrl || "/coming-soon.jpg";
  const caption = liveComingSoon?.caption !== undefined ? liveComingSoon.caption : initialSetting.caption;

  if (isEnabled) {
    return (
      <div className="min-h-screen bg-[#040404] text-off-white flex flex-col justify-between selection:bg-white/20">
        <ComingSoonView
          targetDate={targetDate}
          title={title}
          imageUrl={imageUrl}
          caption={caption}
        />
        <Footer footer={home.footer} />
      </div>
    );
  }

  return <>{children}</>;
}
