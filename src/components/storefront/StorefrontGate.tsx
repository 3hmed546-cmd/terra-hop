import { getComingSoonSettingSync } from "@/lib/server/coming-soon";
import { StorefrontGateClient } from "./StorefrontGateClient";

export function StorefrontGate({ children }: { children: React.ReactNode }) {
  const setting = getComingSoonSettingSync();

  return (
    <StorefrontGateClient initialSetting={setting}>
      {children}
    </StorefrontGateClient>
  );
}
