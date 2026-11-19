"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";
import { countNeedsAction } from "@/lib/admin/inventory";
import { ADMIN_BASE, adminHref, isNavActive, relativeAdminPath } from "@/lib/admin/paths";
import { useAdminStore } from "@/lib/admin/store";
import { isAuthenticated, logout } from "@/lib/admin-auth";
import { registerPushServiceWorker, subscribeToAdminPush } from "@/lib/push-client";
import type { ShortcutAction } from "@/lib/admin/shortcuts";
import { useShortcuts } from "@/lib/admin/use-shortcuts";
import { ShortcutHelpProvider, ShortcutsDialog } from "./ShortcutsDialog";
import { Button, Dialog, ToastProvider } from "./ui";
import { SessionSupersededModal, type SupersededInfo } from "./ui/SessionSupersededModal";
import { Menu, X } from "lucide-react";

const N = ADMIN_STRINGS.nav;
const ITEMS = [
  { path: "/dashboard", label: N.dashboard },
  { path: "/media", label: N.media },
  { path: "/products", label: N.products },
  { path: "/orders", label: N.orders },
  { path: "/promos", label: "أكواد الخصم" },
  { path: "/ambassadors", label: "أكواد الإحالة" },
  { path: "/managers", label: "مسؤولين المتجر" },
  { path: "/whatsapp", label: "بوت الواتساب" },
  { path: "/settings", label: N.settings },
] as const;

function NavList({ relativePath, needsAction, onNavigate }: { relativePath: string; needsAction: number; onNavigate?: () => void }) {
  return (
    <ul className="adm-nav">
      {ITEMS.map((item) => {
        const active = isNavActive(relativePath, item.path);
        const showCount = item.path === "/orders" && needsAction > 0;
        return (
          <li key={item.path}>
            <a
              href={adminHref(item.path)}
              className="adm-nav-link"
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
            >
              <span>{item.label}</span>
              {showCount ? (
                <>
                  <span className="adm-nav-count" aria-hidden="true">{needsAction}</span>
                  <span className="adm-sr">{N.needsAction(needsAction)}</span>
                </>
              ) : null}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function FootLinks({ onNavigate, onShortcuts }: { onNavigate?: () => void; onShortcuts: () => void }) {
  const [loggingOut, setLoggingOut] = useState(false);

  return (
    <div className="adm-sidebar-foot">
      <button type="button" className="adm-nav-link adm-nav-button" onClick={() => { onNavigate?.(); onShortcuts(); }}>
        {ADMIN_STRINGS.shortcuts.open}
      </button>
      <a href="/" className="adm-nav-link" onClick={onNavigate}>{N.viewStore}</a>
      <button
        type="button"
        disabled={loggingOut}
        className="adm-nav-link adm-nav-button"
        style={{ color: "#DC2626", textAlign: "inherit", cursor: "pointer", opacity: loggingOut ? 0.6 : 1 }}
        onClick={() => {
          setLoggingOut(true);
          onNavigate?.();
          logout();
        }}
      >
        {loggingOut ? "جاري تسجيل الخروج…" : N.signOut}
      </button>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const relativePath = relativeAdminPath(usePathname());
  const { data, storageProblem } = useAdminStore();
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [supersededInfo, setSupersededInfo] = useState<SupersededInfo | null>(null);

  const checkSessionStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/auth/session-status", {
        cache: "no-store",
        headers: { "X-Requested-With": "terra-admin" },
      });
      if (!res.ok) return;
      const json = await res.json();
      if (json.ok && json.data?.superseded) {
        setSupersededInfo({
          summary: json.data.newDevice?.summary || "هاتف آخر",
          time: json.data.newDevice?.time || "--:--",
          date: json.data.newDevice?.date || "",
          userEmail: json.data.userEmail || "",
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    const isAuthed = isAuthenticated();
    setAuthed(isAuthed);
    if (!isAuthed) {
      router.replace(adminHref(""));
    } else {
      registerPushServiceWorker()
        .then(() => {
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            subscribeToAdminPush().catch(() => {});
          }
        })
        .catch(() => {});
    }
  }, [router]);

  useEffect(() => {
    if (!authed) return;
    checkSessionStatus();

    const handleVis = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        checkSessionStatus();
      }
    };
    window.addEventListener("visibilitychange", handleVis);
    window.addEventListener("focus", handleVis);

    const timer = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        checkSessionStatus();
      }
    }, 15000);

    return () => {
      window.removeEventListener("visibilitychange", handleVis);
      window.removeEventListener("focus", handleVis);
      clearInterval(timer);
    };
  }, [authed, checkSessionStatus]);

  const needsAction = data ? countNeedsAction(data.orders) : 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const openHelp = useCallback(() => setHelpOpen(true), []);
  const shortcutsOn = data?.settings.shortcuts ?? true;

  useShortcuts(shortcutsOn, (action: ShortcutAction) => {
    if (action.type === "go") window.location.href = adminHref(action.path);
    else if (action.type === "help") setHelpOpen(true);
    else document.querySelector<HTMLInputElement>('#adm-main input[type="search"]')?.focus();
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      if (menuOpen) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "";
      }
    }
    return () => {
      if (typeof document !== "undefined") {
        document.body.style.overflow = "";
      }
    };
  }, [menuOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuOpen) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  if (authed === false) {
    return (
      <div className="min-h-screen bg-obsidian flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white mb-4" />
        <p className="text-sm font-semibold text-gray-300">جاري التحقق والانتقال لصفحة تسجيل الدخول...</p>
      </div>
    );
  }

  return (
    <ToastProvider>
      <ShortcutHelpProvider value={{ open: openHelp }}>
      <div className="adm" dir="rtl">
        <a className="adm-skip" href="#adm-main">{ADMIN_STRINGS.skipToContent}</a>
        <div className="adm-shell">
          <aside className="adm-sidebar">
            <a href={adminHref("/dashboard")} className="adm-brand">{ADMIN_STRINGS.brand}</a>
            <nav aria-label={N.label}>
              <NavList relativePath={relativePath} needsAction={needsAction} />
            </nav>
            <FootLinks onShortcuts={openHelp} />
          </aside>

          <div>
            <header className="adm-topbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "var(--adm-obsidian)", color: "var(--adm-offwhite)" }}>
              <a href={adminHref("/dashboard")} className="adm-brand" style={{ fontSize: "1.1rem" }}>{ADMIN_STRINGS.brand}</a>
              <button
                type="button"
                className="adm-mini-burger"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label={menuOpen ? N.closeMenu : N.menu}
                aria-expanded={menuOpen}
                style={{
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 42,
                  height: 42,
                  borderRadius: 8,
                  backgroundColor: menuOpen ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.22)",
                  color: "#fff",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {menuOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
                {needsAction > 0 && !menuOpen ? (
                  <span
                    style={{
                      position: "absolute",
                      top: -4,
                      right: -4,
                      backgroundColor: "#ef4444",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 800,
                      borderRadius: 999,
                      minWidth: 18,
                      height: 18,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 4px",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
                    }}
                  >
                    {needsAction}
                  </span>
                ) : null}
              </button>
            </header>
            {storageProblem ? (
              <div className="adm-banner" role="status">
                <strong>{ADMIN_STRINGS.shell.storageTitle}.</strong> {ADMIN_STRINGS.shell.storageText}
              </div>
            ) : null}
            <main id="adm-main" tabIndex={-1} className="adm-main">{children}</main>
          </div>
        </div>

        {/* Dedicated Modern Mobile Drawer */}
        {menuOpen && (
          <div
            className="adm-mobile-drawer-root"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 99999,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <div
              className="adm-mobile-drawer-backdrop"
              onClick={closeMenu}
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.75)",
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
              }}
            />

            <div
              className="adm-mobile-drawer-panel"
              style={{
                position: "relative",
                width: "min(320px, 85vw)",
                height: "100%",
                backgroundColor: "var(--adm-obsidian, #0a0a0a)",
                color: "var(--adm-offwhite, #f5f5f5)",
                boxShadow: "-4px 0 24px rgba(0,0,0,0.6)",
                display: "flex",
                flexDirection: "column",
                padding: "20px 16px",
                overflowY: "auto",
                borderLeft: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: 16,
                  marginBottom: 16,
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <span className="adm-brand" style={{ fontSize: "1.1rem" }}>{ADMIN_STRINGS.brand}</span>
                <button
                  type="button"
                  onClick={closeMenu}
                  aria-label={N.closeMenu}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 36,
                    height: 36,
                    borderRadius: 6,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav aria-label={N.label} style={{ flex: 1 }}>
                <NavList relativePath={relativePath} needsAction={needsAction} onNavigate={closeMenu} />
              </nav>

              <FootLinks onNavigate={closeMenu} onShortcuts={openHelp} />
            </div>
          </div>
        )}

        <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} enabled={shortcutsOn} />
        {supersededInfo && <SessionSupersededModal info={supersededInfo} />}
      </div>
      </ShortcutHelpProvider>
    </ToastProvider>
  );
}
