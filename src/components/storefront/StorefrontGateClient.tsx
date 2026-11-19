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
  const { data: liveProducts } = useLive("products");

  // Keep admin, secret vault, ambassador, shop, and API routes always accessible
  const isExcluded =
    initialIsAdmin ||
    !pathname ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/admin-login") ||
    (ADMIN_BASE && pathname.startsWith(ADMIN_BASE)) ||
    pathname.includes("vault") ||
    pathname.startsWith("/ambassador") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/shop") ||
    pathname.startsWith("/cart") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/order");

  if (isExcluded) {
    return <>{children}</>;
  }

  // When products exist in the store, Coming Soon MUST NEVER appear (per merchant guidelines)
  const hasProducts = Array.isArray(liveProducts)
    ? liveProducts.length > 0
    : Boolean(initialSetting.hasProducts);

  if (hasProducts) {
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
  const mobileImageUrl =
    liveComingSoon?.mobileImageUrl || initialSetting.mobileImageUrl || "/coming-soon-mobile.jpg";
  const caption = liveComingSoon?.caption !== undefined ? liveComingSoon.caption : initialSetting.caption;

  if (isEnabled) {
    return (
      <div className="min-h-screen bg-[#040404] text-off-white flex flex-col justify-between selection:bg-white/20">
        <ComingSoonView
          targetDate={targetDate}
          title={title}
          imageUrl={imageUrl}
          mobileImageUrl={mobileImageUrl}
          caption={caption}
        />
        <Footer footer={home.footer} />
      </div>
    );
  }

  return <>{children}</>;
}
