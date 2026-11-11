import { Suspense } from "react";
import { headers } from "next/headers";
import { getComingSoonSettingServer } from "@/lib/server/coming-soon";
import { StorefrontGateClient } from "./StorefrontGateClient";
import { ADMIN_BASE } from "@/lib/admin/paths";

async function GateServer({ children }: { children: React.ReactNode }) {
  const [headersList, setting] = await Promise.all([
    headers(),
    getComingSoonSettingServer(),
  ]);

  const pathname = headersList.get("x-pathname") || "";

  const isAdmin =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/admin-login") ||
    (Boolean(ADMIN_BASE) && pathname.startsWith(ADMIN_BASE)) ||
    pathname.includes("vault") ||
    pathname.startsWith("/ambassador") ||
    pathname.startsWith("/api");

  return (
    <StorefrontGateClient
      initialSetting={setting}
      initialIsAdmin={isAdmin}
    >
      {children}
    </StorefrontGateClient>
  );
}

export function StorefrontGate({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#040404]" />}>
      <GateServer>{children}</GateServer>
    </Suspense>
  );
}
