// @vitest-environment jsdom
import axe from "axe-core";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";
import { formatMoney } from "@/lib/admin/format";
import { adminHref } from "@/lib/admin/paths";
import { adminActions } from "@/lib/admin/store";
import type { AdminData } from "@/lib/admin/types";
import { Dashboard } from "./dashboard/Dashboard";
import { OrderDetail } from "./orders/OrderDetail";
import { OrdersList } from "./orders/OrdersList";
import { ProductForm } from "./products/ProductForm";
import { RecordSaleForm } from "./sales/RecordSaleForm";
import { ToastProvider } from "./ui";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/admin/dashboard",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const D = ADMIN_STRINGS.dashboard;
const O = ADMIN_STRINGS.orders.detail;
const SALE = ADMIN_STRINGS.sale;
const LOG = ADMIN_STRINGS.stockLog;
const RS = ADMIN_STRINGS.restock;
const F = ADMIN_STRINGS.productForm;

const stored = (): AdminData => JSON.parse(localStorage.getItem("terra-hop-admin-preview")!).data;
const stockOf = (d: AdminData, productId: string, color: string, size: string) =>
  d.products.find((p) => p.id === productId)!.variants.find((v) => v.colorId === color && v.size === size)!.stock;
const show = (ui: ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);
const kpiText = (label: string) => screen.getByText(label).parentElement!.textContent ?? "";

async function a11y(container: HTMLElement) {
  const results = await axe.run(container, {
    // jsdom has no layout, so contrast is checked by eye; page-level rules need a whole page
    rules: {
      "color-contrast": { enabled: false },
      region: { enabled: false },
      "landmark-one-main": { enabled: false },
      "page-has-heading-one": { enabled: false },
    },
  });
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-30T10:00:00.000Z"));
  localStorage.clear();
  adminActions.resetDemo();
  push.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Dashboard", () => {
  it("shows the four numbers and both lists from the demo data", () => {
    const { container } = show(<Dashboard />);
    const d = stored();
    const soldTotal = d.orders.filter((o) => o.status === "SOLD").reduce((s, o) => s + o.totalCents, 0);
    expect(kpiText(D.kpi.needsAction)).toContain("3");
    expect(kpiText(D.kpi.salesToday)).toContain("EGP 0");
    expect(kpiText(D.kpi.salesMonth)).toContain(formatMoney(soldTotal));
    expect(kpiText(D.kpi.salesMonth)).toContain("4 orders");
    expect(screen.getAllByText("TH-1012").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Zip Hoodie").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Archive Tee").length).toBeGreaterThan(0);
    expect(screen.queryByText("Fleece Pullover")).toBeNull(); // drafts are not listed
    expect(container.querySelector('a[href$="/sales/new"]')?.textContent).toBe(D.recordSale);
  });

  it("marks an order as sold from the list: stock drops, today's sales and the queue update", () => {
    show(<Dashboard />);
    const before = stored();
    fireEvent.click(screen.getAllByRole("button", { name: D.decision.sellAria("TH-1012") })[0]);
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: ADMIN_STRINGS.orders.detail.sellDialog.confirm }));

    const after = stored();
    expect(after.orders.find((o) => o.number === "TH-1012")!.status).toBe("SOLD");
    expect(stockOf(after, "p_oversized_tee", "black", "L")).toBe(stockOf(before, "p_oversized_tee", "black", "L") - 2);
    expect(screen.getByText(O.sellDialog.done("TH-1012"))).toBeTruthy();
    expect(kpiText(D.kpi.needsAction)).toContain("2");
    expect(kpiText(D.kpi.salesToday)).toContain("1 order");
    expect(screen.queryByRole("button", { name: D.decision.sellAria("TH-1012") })).toBeNull();
  });

  it("blocks Mark as sold when stock is short and explains why", () => {
    show(<Dashboard />);
    const sell = screen.getAllByRole("button", { name: D.decision.sellAria("TH-1008") })[0];
    expect(sell.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getAllByText(D.decision.blocked).length).toBeGreaterThan(0);
    fireEvent.click(sell);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(stored().orders.find((o) => o.number === "TH-1008")!.status).toBe("AWAITING_APPROVAL");
  });

  it("cancels from the list with a reason", () => {
    show(<Dashboard />);
    fireEvent.click(screen.getAllByRole("button", { name: D.decision.cancelAria("TH-1009") })[0]);
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(O.cancelDialog.reason), { target: { value: "No answer" } });
    fireEvent.click(within(dialog).getByRole("button", { name: O.cancelDialog.confirm }));
    const order = stored().orders.find((o) => o.number === "TH-1009")!;
    expect(order).toMatchObject({ status: "CANCELLED", cancelReason: "No answer" });
  });

  it("restocks a low product: the pieces are added and it leaves the list", () => {
    show(<Dashboard />);
    const before = stockOf(stored(), "p_zip_hoodie", "black", "M");
    fireEvent.click(screen.getAllByRole("button", { name: D.lowStock.restockAria("Zip Hoodie") })[0]);
    const dialog = screen.getByRole("dialog");

    const confirm = within(dialog).getByRole("button", { name: RS.confirm });
    expect(confirm.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(confirm); // nothing entered yet: nothing happens
    expect(stockOf(stored(), "p_zip_hoodie", "black", "M")).toBe(before);

    fireEvent.change(within(dialog).getByLabelText(RS.addLabel("Black · M")), { target: { value: "5" } });
    expect(within(dialog).getByText(RS.totalAdd(5))).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText(RS.reason), { target: { value: "Delivery" } });
    fireEvent.click(within(dialog).getByRole("button", { name: RS.confirm }));

    const after = stored();
    expect(stockOf(after, "p_zip_hoodie", "black", "M")).toBe(before + 5);
    expect(after.movements.at(-1)).toMatchObject({ delta: 5, reason: "manual_adjust", note: "Delivery" });
    expect(screen.getByText(RS.done(5, "Zip Hoodie"))).toBeTruthy();
    expect(screen.queryByRole("button", { name: D.lowStock.restockAria("Zip Hoodie") })).toBeNull();
  });

  it("has no accessibility violations axe can find (page, then with a dialog open)", async () => {
    const { container } = show(<Dashboard />);
    expect(await a11y(container)).toEqual([]);
    fireEvent.click(screen.getAllByRole("button", { name: D.lowStock.restockAria("Zip Hoodie") })[0]);
    expect(await a11y(container)).toEqual([]);
  });
});

describe("Record a sale", () => {
  it("records a manual sale, deducts stock and opens the new order", () => {
    show(<RecordSaleForm />);
    const before = stored();
    fireEvent.change(screen.getByLabelText(new RegExp(`^${SALE.qty}`)), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(SALE.buyer), { target: { value: "Sara" } });
    fireEvent.click(screen.getByRole("button", { name: SALE.submit }));

    const after = stored();
    const order = after.orders.at(-1)!;
    expect(after.orders).toHaveLength(before.orders.length + 1);
    expect(order).toMatchObject({ source: "manual", status: "SOLD", number: "TH-1013" });
    expect(order.customer.name).toBe("Sara");
    expect(order.items[0].qty).toBe(2);
    const item = order.items[0];
    const v = (d: AdminData) => d.products.find((p) => p.id === item.productId)!.variants.find((x) => x.id === item.variantId)!.stock;
    expect(v(after)).toBe(v(before) - 2);
    expect(push).toHaveBeenCalledWith(adminHref(`/orders/${order.id}`));
    expect(screen.getByText(SALE.done("TH-1013"))).toBeTruthy();
  });

  it("shows what is left and the total while you type", () => {
    show(<RecordSaleForm />);
    const status = screen.getAllByRole("status").find((n) => n.textContent?.includes(SALE.summary.total))!;
    expect(status.textContent).toContain(formatMoney(45000)); // 1 x Oversized Tee
    fireEvent.change(screen.getByLabelText(new RegExp(`^${SALE.qty}`)), { target: { value: "3" } });
    expect(status.textContent).toContain(formatMoney(135000));
  });

  it("refuses more than the stock and keeps the data unchanged", () => {
    show(<RecordSaleForm />);
    const before = stored();
    fireEvent.change(screen.getByLabelText(new RegExp(`^${SALE.qty}`)), { target: { value: "999" } });
    fireEvent.click(screen.getByRole("button", { name: SALE.submit }));
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/Only \d+ pieces? (is|are) in stock/);
    expect(stored().orders).toHaveLength(before.orders.length);
    expect(push).not.toHaveBeenCalled();
  });

  it("only offers colours and sizes that have stock", () => {
    show(<RecordSaleForm />);
    fireEvent.change(screen.getByLabelText(new RegExp(`^${SALE.product}`)), { target: { value: "p_terra_hoodie" } });
    const size = screen.getByLabelText(new RegExp(`^${SALE.size}`)) as HTMLSelectElement;
    fireEvent.change(screen.getByLabelText(new RegExp(`^${SALE.color}`)), { target: { value: "olive" } });
    const m = [...size.options].find((o) => o.value === "M")!;
    expect(m.disabled).toBe(true); // Olive M has nothing left
    expect(m.textContent).toContain(SALE.noStockSuffix.trim());
    expect(size.value).not.toBe("M");
  });

  it("has no accessibility violations axe can find, also with errors showing", async () => {
    const { container } = show(<RecordSaleForm />);
    expect(await a11y(container)).toEqual([]);
    fireEvent.change(screen.getByLabelText(new RegExp(`^${SALE.qty}`)), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: SALE.submit }));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(await a11y(container)).toEqual([]);
  });
});

describe("Product page: Stock log and Restock", () => {
  const openLog = () => fireEvent.click(screen.getByRole("tab", { name: LOG.tabLog }));

  it("shows the stock log in a tab, newest first, with order links", () => {
    show(<ProductForm productId="p_zip_hoodie" />);
    expect(screen.getByRole("tab", { name: LOG.tabDetails }).getAttribute("aria-selected")).toBe("true");
    openLog();
    expect(screen.getByRole("tab", { name: LOG.tabLog }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getAllByText(LOG.reasons.initial).length).toBeGreaterThan(0);
    const link = screen.getAllByRole("link").find((a) => /^TH-\d+$/.test(a.textContent ?? ""))!;
    expect(link.getAttribute("href")).toMatch(/\/orders\/ord_\d+$/);
  });

  it("filters the log by colour and size", () => {
    show(<ProductForm productId="p_zip_hoodie" />);
    openLog();
    fireEvent.change(screen.getByLabelText(LOG.filterLabel), { target: { value: stored().products.find((p) => p.id === "p_zip_hoodie")!.variants.find((v) => v.size === "L")!.id } });
    expect(screen.getAllByText(/Black · L/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Black · XL/).filter((n) => n.tagName !== "OPTION")).toHaveLength(0);
  });

  it("restock keeps you on the log, moves focus there, and a later Save does not undo it", () => {
    show(<ProductForm productId="p_zip_hoodie" />);
    openLog();
    const before = stored();
    fireEvent.click(screen.getByRole("button", { name: LOG.restock }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText(RS.addLabel("Black · M")), { target: { value: "4" } });
    fireEvent.click(within(dialog).getByRole("button", { name: RS.confirm }));

    const restocked = stored();
    expect(stockOf(restocked, "p_zip_hoodie", "black", "M")).toBe(stockOf(before, "p_zip_hoodie", "black", "M") + 4);
    expect(screen.getByRole("tab", { name: LOG.tabLog }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getAllByText(LOG.reasons.manual_adjust).length).toBeGreaterThan(0);
    expect(document.activeElement?.id).toBe("stock-log-title");

    // The Details form was rebuilt with the new numbers: saving must not write the old ones back.
    fireEvent.click(screen.getByRole("tab", { name: LOG.tabDetails }));
    const cell = screen.getByLabelText(F.cell("Black", "M")) as HTMLInputElement;
    expect(cell.value).toBe(String(stockOf(restocked, "p_zip_hoodie", "black", "M")));
    fireEvent.click(screen.getByRole("button", { name: F.actions.saveChanges }));
    const saved = stored();
    expect(stockOf(saved, "p_zip_hoodie", "black", "M")).toBe(stockOf(restocked, "p_zip_hoodie", "black", "M"));
    expect(saved.movements).toHaveLength(restocked.movements.length);
  });

  it("pauses Restock while the form has unsaved changes", () => {
    show(<ProductForm productId="p_zip_hoodie" />);
    fireEvent.change(screen.getByLabelText(new RegExp(`^${F.name}`)), { target: { value: "Zip Hoodie v2" } });
    openLog();
    const restock = screen.getByRole("button", { name: LOG.restock });
    expect(restock.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText(LOG.restockBlocked)).toBeTruthy();
    fireEvent.click(restock);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("has no accessibility violations axe can find on the log tab and the restock dialog", async () => {
    const { container } = show(<ProductForm productId="p_zip_hoodie" />);
    openLog();
    expect(await a11y(container)).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: LOG.restock }));
    expect(await a11y(container)).toEqual([]);
  });
});

describe("Order page after the dialogs were shared with the Dashboard", () => {
  it("sells, then cancels with the stock returned, and moves focus to the status line", () => {
    const { container } = show(<OrderDetail orderId="ord_1012" />);
    const before = stored();
    const line = (d: AdminData) => stockOf(d, "p_oversized_tee", "black", "L");

    fireEvent.click(screen.getByRole("button", { name: O.decision.sell }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: O.sellDialog.confirm }));
    expect(stored().orders.find((o) => o.id === "ord_1012")!.status).toBe("SOLD");
    expect(line(stored())).toBe(line(before) - 2);
    expect(document.activeElement?.classList.contains("adm-sr-focus")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: O.decision.cancel }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("alert")).toBeTruthy(); // warns that stock goes back
    fireEvent.change(within(dialog).getByLabelText(O.cancelDialog.reason), { target: { value: "Returned" } });
    fireEvent.click(within(dialog).getByRole("button", { name: O.cancelDialog.confirm }));
    const after = stored();
    expect(after.orders.find((o) => o.id === "ord_1012")).toMatchObject({ status: "CANCELLED", cancelReason: "Returned" });
    expect(line(after)).toBe(line(before));
    expect(container.querySelector("dialog[open]")).toBeNull();
  });

  it("still blocks a short order and has no accessibility violations axe can find", async () => {
    const { container } = show(<OrderDetail orderId="ord_1008" />);
    const sell = screen.getByRole("button", { name: O.decision.sell });
    expect(sell.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(sell);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await a11y(container)).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: O.decision.cancel }));
    expect(await a11y(container)).toEqual([]);
  });
});

describe("Acceptance: a manual sale appears in Orders and moves the Dashboard", () => {
  it("shows as a Manual order under Sold, and the month total and today's sales grow", () => {
    const before = stored();
    const soldBefore = before.orders.filter((o) => o.status === "SOLD").reduce((s, o) => s + o.totalCents, 0);
    const result = adminActions.recordSale({ variantId: "p_oversized_tee__black__m", qty: 1, unitPriceCents: 45000 });
    expect(result).toMatchObject({ ok: true, orderNumber: "TH-1013" });

    const dash = show(<Dashboard />);
    expect(kpiText(D.kpi.salesMonth)).toContain(formatMoney(soldBefore + 45000));
    expect(kpiText(D.kpi.salesMonth)).toContain("5 orders");
    expect(kpiText(D.kpi.salesToday)).toContain(formatMoney(45000));
    dash.unmount();

    show(<OrdersList />);
    fireEvent.click(screen.getByRole("tab", { name: /^Sold/ }));
    expect(screen.getAllByText("TH-1013").length).toBeGreaterThan(0);
    expect(screen.getAllByText(ADMIN_STRINGS.orders.source.manual).length).toBeGreaterThan(0);
  });
});
