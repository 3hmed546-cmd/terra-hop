// @vitest-environment jsdom
import axe from "axe-core";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";
import { lowStockProducts } from "@/lib/admin/inventory";
import { adminHref } from "@/lib/admin/paths";
import { adminActions } from "@/lib/admin/store";
import type { AdminData } from "@/lib/admin/types";
import AdminError from "@/app/admin/error";
import { AdminShell } from "./AdminShell";
import { Dashboard } from "./dashboard/Dashboard";
import { OrdersList } from "./orders/OrdersList";
import { ProductForm } from "./products/ProductForm";
import { SettingsPage } from "./settings/SettingsPage";
import { ToastProvider } from "./ui";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/admin/settings",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const S = ADMIN_STRINGS.settings;
const PW = S.password;
const SC = ADMIN_STRINGS.shortcuts;
const F = ADMIN_STRINGS.productForm;

const KEY = "terra-hop-admin-preview";
const stored = (): AdminData => JSON.parse(localStorage.getItem(KEY)!).data;
const show = (ui: ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);

async function a11y(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: {
      "color-contrast": { enabled: false }, // jsdom has no layout: contrast is checked in the real browser
      region: { enabled: false },
      "landmark-one-main": { enabled: false },
      "page-has-heading-one": { enabled: false },
    },
  });
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

const field = (label: string) => screen.getByLabelText(new RegExp(`^${label}`)) as HTMLInputElement;
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-31T10:00:00.000Z"));
  localStorage.clear();
  adminActions.resetDemo();
  push.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Settings page", () => {
  it("shows the current values and has no accessibility violations", async () => {
    const { container } = show(<SettingsPage />);
    expect(field(S.storeName).value).toBe("Terra Hop");
    expect(field(S.shipping).value).toBe("60");
    expect(field(S.lowStock).value).toBe("3");
    expect(field(S.emailHours).value).toBe("24");
    expect((screen.getByRole("radio", { name: new RegExp(S.reservation.none) }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: new RegExp(S.shortcuts.toggle) }) as HTMLInputElement).checked).toBe(true);
    expect(await a11y(container)).toEqual([]);
  });

  it("labels the parts that are preview only, in text", () => {
    show(<SettingsPage />);
    expect(screen.getAllByText(S.previewOnly).length).toBe(3); // session, password, sign out
  });

  it("saves store name and shipping, shows them in the email preview, and keeps them after reload", () => {
    show(<SettingsPage />);
    type(S.storeName, "Terra Hop Cairo");
    type(S.shipping, "75.5");
    expect(screen.getByText(S.template.subject("Terra Hop Cairo"))).toBeTruthy();
    click(S.save);
    expect(stored().settings).toMatchObject({ storeName: "Terra Hop Cairo", shippingCents: 7550 });
    expect(screen.getByText(S.saved)).toBeTruthy();
  });

  it("uses the new shipping fee for new orders only", () => {
    show(<SettingsPage />);
    type(S.shipping, "100");
    click(S.save);
    const before = stored().orders.length;
    const result = adminActions.simulateOrder("awaiting");
    expect(result.ok).toBe(true);
    const orders = stored().orders;
    expect(orders.length).toBe(before + 1);
    expect(orders[orders.length - 1]!.shippingCents).toBe(10000);
    expect(orders.slice(0, before).some((o) => o.shippingCents === 10000)).toBe(false); // placed earlier: unchanged
  });

  it("applies the new low-stock threshold to which products count as low", () => {
    show(<SettingsPage />);
    const before = lowStockProducts(stored()).length;
    type(S.lowStock, "40");
    click(S.save);
    expect(stored().settings.lowStockThreshold).toBe(40);
    expect(lowStockProducts(stored()).length).toBeGreaterThan(before);
  });

  it("saves the reservation mode, session length and shortcuts switch", () => {
    show(<SettingsPage />);
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(S.reservation.hold) }));
    fireEvent.change(screen.getByLabelText(new RegExp(`^${S.session}`)), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(S.shortcuts.toggle) }));
    click(S.save);
    expect(stored().settings).toMatchObject({ reservation: "hold", sessionHours: 8, shortcuts: false });
  });

  it("refuses bad values with a focused summary and a message beside each field, and saves nothing", async () => {
    const { container } = show(<SettingsPage />);
    const before = JSON.stringify(stored().settings);
    type(S.storeName, "   ");
    type(S.shipping, "");
    type(S.lowStock, "0");
    click(S.save);
    const summary = screen.getByRole("alert");
    expect(summary.textContent).toContain(S.summaryTitle(3));
    expect(document.activeElement).toBe(summary);
    expect(field(S.storeName).getAttribute("aria-invalid")).toBe("true");
    expect(field(S.storeName).getAttribute("aria-describedby")).toBeTruthy();
    expect(JSON.stringify(stored().settings)).toBe(before);
    expect(await a11y(container)).toEqual([]);
  });

  it("says so when there is nothing to save, and Discard puts the old values back", () => {
    show(<SettingsPage />);
    click(S.save);
    expect(screen.getByText(S.noChanges)).toBeTruthy();
    type(S.storeName, "Changed");
    click(S.discard);
    expect(field(S.storeName).value).toBe("Terra Hop");
    expect(screen.getByText(S.discarded)).toBeTruthy();
  });

  it("warns before leaving with unsaved changes, and lets you stay or leave", () => {
    show(<><a href="/somewhere-else">elsewhere</a><SettingsPage /></>);
    type(S.storeName, "Changed");
    fireEvent.click(screen.getByText("elsewhere"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(F.unsaved.title)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: F.unsaved.stay }));
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("elsewhere"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: F.unsaved.leave }));
    expect(push).toHaveBeenCalledWith("/somewhere-else");
  });

  it("does not warn after a successful save", () => {
    show(<><a href="/somewhere-else">elsewhere</a><SettingsPage /></>);
    type(S.storeName, "Saved name");
    click(S.save);
    fireEvent.click(screen.getByText("elsewhere"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Reset demo data brings the default settings back into the form", () => {
    show(<SettingsPage />);
    type(S.storeName, "Temporary");
    click(S.save);
    expect(field(S.storeName).value).toBe("Temporary");
    click(S.demo.reset);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: S.demo.reset }));
    expect(stored().settings.storeName).toBe("Terra Hop");
    expect(field(S.storeName).value).toBe("Terra Hop");
  });

  it("validates the password form, and a valid one only reports that nothing changed", async () => {
    const { container } = show(<SettingsPage />);
    click(PW.button);
    expect(screen.getAllByRole("alert").some((a) => a.textContent?.includes(PW.errors.CURRENT_REQUIRED))).toBe(true);
    expect(await a11y(container)).toEqual([]);

    type(PW.current, "old-password-1");
    type(PW.next, "a-much-longer-password");
    type(PW.confirm, "a-much-longer-password");
    click(PW.button);
    expect(screen.getByText(PW.done)).toBeTruthy();
    expect(field(PW.current).value).toBe(""); // cleared
    expect(JSON.stringify(stored())).not.toContain("a-much-longer-password"); // never stored
  });

  it("sign out everywhere asks first, and only reports that no sessions exist", () => {
    show(<SettingsPage />);
    click(S.signOutAll.button);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: ADMIN_STRINGS.common.cancel }));
    expect(screen.queryByText(S.signOutAll.done)).toBeNull();
    click(S.signOutAll.button);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: S.signOutAll.confirm }));
    expect(screen.getByText(S.signOutAll.done)).toBeTruthy();
  });
});

describe("Keyboard shortcuts in the shell", () => {
  const press = (key: string, extra: KeyboardEventInit = {}) =>
    fireEvent.keyDown(document.body, { key, code: /^[a-z]$/.test(key) ? `Key${key.toUpperCase()}` : "", ...extra });

  it("goes to Orders with G then O, and to a new product with N", () => {
    show(<AdminShell>content</AdminShell>);
    press("g");
    press("o");
    expect(push).toHaveBeenCalledWith(adminHref("/orders"));
    press("n");
    expect(push).toHaveBeenCalledWith(adminHref("/products/new"));
  });

  it("opens the shortcut list with ? and lists every shortcut", async () => {
    const { container } = show(<AdminShell>content</AdminShell>);
    press("?", { shiftKey: true });
    const dialog = screen.getByRole("dialog", { name: SC.title });
    for (const item of SC.items) expect(within(dialog).getByText(item.label)).toBeTruthy();
    expect(await a11y(container)).toEqual([]);
  });

  it("focuses the search box with /", () => {
    show(<AdminShell><input type="search" aria-label="Search things" /></AdminShell>);
    press("/");
    expect(document.activeElement).toBe(screen.getByLabelText("Search things"));
  });

  it("does nothing while typing in a field", () => {
    show(<AdminShell><input aria-label="Name" /></AdminShell>);
    const input = screen.getByLabelText("Name");
    input.focus();
    fireEvent.keyDown(input, { key: "n", code: "KeyN" });
    expect(push).not.toHaveBeenCalled();
  });

  it("does nothing once shortcuts are turned off in Settings", () => {
    adminActions.updateSettings({ shortcuts: false });
    show(<AdminShell>content</AdminShell>);
    press("n");
    press("?", { shiftKey: true });
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: SC.title })).toBeNull();
  });
});

describe("Shell and error states", () => {
  it("tells the owner when the browser cannot save, and says so as a status message", () => {
    show(<AdminShell>content</AdminShell>);
    expect(screen.queryByText(new RegExp(ADMIN_STRINGS.shell.storageTitle))).toBeNull();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    act(() => { adminActions.updateSettings({ storeName: "Still works" }); });
    const banner = screen.getByRole("status");
    expect(banner.textContent).toContain(ADMIN_STRINGS.shell.storageTitle);
  });

  it("the banner goes away once saving works again", () => {
    show(<AdminShell>content</AdminShell>);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    act(() => { adminActions.updateSettings({ storeName: "A" }); });
    expect(screen.queryByText(new RegExp(ADMIN_STRINGS.shell.storageTitle))).not.toBeNull();
    spy.mockRestore();
    act(() => { adminActions.updateSettings({ storeName: "B" }); });
    expect(screen.queryByText(new RegExp(ADMIN_STRINGS.shell.storageTitle))).toBeNull();
  });

  it("older saved data without the new settings gets the defaults filled in", async () => {
    const old = stored();
    const { sessionHours: _s, shortcuts: _k, ...legacy } = old.settings;
    void _s; void _k;
    localStorage.setItem(KEY, JSON.stringify({ version: 1, data: { ...old, settings: legacy } }));
    vi.resetModules();
    const fresh = await import("@/lib/admin/store");
    fresh.adminActions.updateSettings({ storeName: "Legacy store" });
    expect(stored().settings).toMatchObject({ storeName: "Legacy store", sessionHours: 24, shortcuts: true });
  });

  it("the error page shows a calm message, focuses it, and Try again calls reset", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    const { container } = show(<AdminError error={new Error("boom: secret detail")} reset={reset} />);
    const alert = screen.getByRole("alert");
    expect(document.activeElement).toBe(alert);
    expect(alert.textContent).not.toContain("secret detail");
    fireEvent.click(screen.getByRole("button", { name: ADMIN_STRINGS.errorPage.retry }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(await a11y(container)).toEqual([]);
  });
});

describe("Accessible names", () => {
  // WCAG 2.5.3 (label in name): a voice-control user says what they see on the button.
  function mismatches(container: HTMLElement) {
    const bad: string[] = [];
    for (const el of container.querySelectorAll<HTMLElement>("button[aria-label], a[aria-label]")) {
      const visible = (el.textContent ?? "").replace(/\s+/g, " ").trim().toLowerCase();
      const name = (el.getAttribute("aria-label") ?? "").toLowerCase();
      if (visible && !name.includes(visible)) bad.push(`"${visible}" is not in "${name}"`);
    }
    return bad;
  }

  it("every button and link with an aria-label contains its visible text (dashboard, product form, orders)", () => {
    for (const ui of [<Dashboard key="d" />, <ProductForm key="p" productId="p_oversized_tee" />, <OrdersList key="o" />]) {
      const { container, unmount } = show(ui);
      expect(mismatches(container)).toEqual([]);
      unmount();
    }
  });
});

describe("Removing a colour that an open order uses", () => {
  const removeBlack = () => fireEvent.click(screen.getByRole("button", { name: F.removeColor("Black") }));

  it("warns, names the orders, and keeps the product unchanged if you keep editing", async () => {
    const { container } = show(<ProductForm productId="p_oversized_tee" />);
    removeBlack();
    click(F.actions.saveChanges);
    const dialog = screen.getByRole("dialog", { name: F.removeVariants.title });
    expect(dialog.textContent).toContain("TH-1011");
    expect(dialog.textContent).toContain("TH-1012");
    expect(await a11y(container)).toEqual([]);
    fireEvent.click(within(dialog).getByRole("button", { name: F.removeVariants.keep }));
    expect(stored().products.find((p) => p.id === "p_oversized_tee")!.colors.some((c) => c.id === "black")).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });

  it("removes the colour only after you confirm", () => {
    show(<ProductForm productId="p_oversized_tee" />);
    removeBlack();
    click(F.actions.saveChanges);
    fireEvent.click(within(screen.getByRole("dialog", { name: F.removeVariants.title })).getByRole("button", { name: F.removeVariants.confirm }));
    expect(stored().products.find((p) => p.id === "p_oversized_tee")!.colors.some((c) => c.id === "black")).toBe(false);
    expect(push).toHaveBeenCalledWith(adminHref("/products"));
  });

  it("saves straight away when no open order is affected", () => {
    show(<ProductForm productId="p_oversized_tee" />);
    fireEvent.change(screen.getByLabelText(new RegExp(`^${F.name}`)), { target: { value: "Oversized Tee v2" } });
    click(F.actions.saveChanges);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(stored().products.find((p) => p.id === "p_oversized_tee")!.name).toBe("Oversized Tee v2");
  });
});
