"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";
import { dashboardKpis, decisionQueue, restockCandidates } from "@/lib/admin/dashboard";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/admin/format";
import { deriveProductStatus, productTotalStock } from "@/lib/admin/inventory";
import { itemsSummary, orderPieces, sellBlockReason } from "@/lib/admin/orders";
import { adminHref } from "@/lib/admin/paths";
import { useAdminStore } from "@/lib/admin/store";
import type { Order, Product } from "@/lib/admin/types";
import { OrderDecisionDialogs, type DecisionMode } from "../orders/OrderDecisionDialogs";
import { PageHeader } from "../PageHeader";
import { RestockDialog } from "../products/RestockDialog";
import { MediaGallery } from "../media/MediaGallery";
import { Button, EmptyState, StatCard, StatusBadge, Table, type Column } from "../ui";

const D = ADMIN_STRINGS.dashboard;
const O = ADMIN_STRINGS.orders;
const LOW_LIST_LIMIT = 8;

export function Dashboard() {
  const { data, ready } = useAdminStore();
  const [now] = useState(() => new Date().toISOString());
  const [decision, setDecision] = useState<{ order: Order; mode: DecisionMode } | null>(null);
  const [restock, setRestock] = useState<Product | null>(null);
  const decisionHeading = useRef<HTMLHeadingElement>(null);
  const lowHeading = useRef<HTMLHeadingElement>(null);
  const refocus = useRef<"decision" | "low" | null>(null);

  // A decision or restock can remove the row that opened the dialog: move focus to the section title.
  useEffect(() => {
    if (decision === null && restock === null && refocus.current) {
      (refocus.current === "decision" ? decisionHeading : lowHeading).current?.focus();
      refocus.current = null;
    }
  }, [decision, restock]);

  const kpis = useMemo(() => (data ? dashboardKpis(data, now) : null), [data, now]);
  const queue = useMemo(() => (data ? decisionQueue(data.orders) : null), [data]);
  const low = useMemo(() => (data ? restockCandidates(data) : []), [data]);

  const recordSale = (
    <Link className="adm-btn adm-btn-primary" href={adminHref("/sales/new")}>{D.recordSale}</Link>
  );
  const header = <PageHeader title={ADMIN_STRINGS.pages.dashboard.title} description={ADMIN_STRINGS.pages.dashboard.summary} actions={recordSale} />;

  if (!ready || !data || !kpis || !queue) {
    return (
      <>
        {header}
        <div className="adm-skeleton" role="status">
          <span className="adm-sr">{ADMIN_STRINGS.common.loading}</span>
        </div>
      </>
    );
  }

  const threshold = data.settings.lowStockThreshold;

  const decisionButtons = (order: Order) => {
    const blocked = sellBlockReason(data, order) === "insufficient_stock";
    const noteId = `blocked-${order.id}`;

    if (order.status === "PROCESSING") {
      return (
        <div className="adm-stack-sm">
          <div className="adm-actions">
            <Button
              className="adm-btn-sm"
              style={{ backgroundColor: "#10b981", color: "#ffffff" }}
              onClick={() => setDecision({ order, mode: "deliver" })}
            >
              اكتمال تسليم الأوردر
            </Button>
            <Button
              variant="secondary"
              className="adm-btn-sm"
              aria-label={D.decision.cancelAria(order.number)}
              onClick={() => setDecision({ order, mode: "cancel" })}
            >
              {D.decision.cancel}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="adm-stack-sm">
        <div className="adm-actions">
          <Button
            className="adm-btn-sm"
            aria-label={D.decision.sellAria(order.number)}
            aria-disabled={blocked ? true : undefined}
            aria-describedby={blocked ? noteId : undefined}
            onClick={() => { if (!blocked) setDecision({ order, mode: "confirm" }); }}
          >
            تأكيد الأوردر
          </Button>
          <Button variant="secondary" className="adm-btn-sm" aria-label={D.decision.cancelAria(order.number)} onClick={() => setDecision({ order, mode: "cancel" })}>
            {D.decision.cancel}
          </Button>
        </div>
        {blocked ? <p id={noteId} className="adm-warn adm-small adm-nomargin">{D.decision.blocked}</p> : null}
      </div>
    );
  };

  const orderLink = (order: Order) => (
    <div>
      <Link className="adm-plink adm-num" href={adminHref(`/orders/${order.id}`)} aria-label={O.viewAria(order.number)}>{order.number}</Link>
      <div className="adm-muted adm-small adm-num">{formatDateTime(order.createdAt)}</div>
    </div>
  );

  const itemsCell = (order: Order) => {
    const { first, more } = itemsSummary(order);
    return (
      <div>
        <div>{first}</div>
        <div className="adm-muted adm-small">
          {more > 0 ? `${O.more(more)} · ` : ""}
          {O.pieces(orderPieces(order))}
        </div>
      </div>
    );
  };

  const decisionColumns: Column<Order>[] = [
    { key: "order", header: D.decision.columns.order, cell: orderLink },
    { key: "customer", header: D.decision.columns.customer, cell: (o) => o.customer.name },
    { key: "items", header: D.decision.columns.items, cell: itemsCell },
    { key: "total", header: D.decision.columns.total, align: "end", cell: (o) => <span className="adm-num">{formatMoney(o.totalCents)}</span> },
    { key: "actions", header: D.decision.columns.actions, align: "end", cell: decisionButtons },
  ];

  const lowColumns: Column<Product>[] = [
    {
      key: "product",
      header: D.lowStock.columns.product,
      cell: (p) => <Link className="adm-plink" href={adminHref(`/products/${p.id}`)}>{p.name}</Link>,
    },
    { key: "stock", header: D.lowStock.columns.stock, align: "end", cell: (p) => <span className="adm-num">{formatNumber(productTotalStock(p))}</span> },
    {
      key: "status",
      header: D.lowStock.columns.status,
      cell: (p) => {
        const s = deriveProductStatus(p, threshold);
        return <StatusBadge kind={s.kind} left={s.total} />;
      },
    },
    {
      key: "actions",
      header: D.lowStock.columns.actions,
      align: "end",
      cell: (p) => (
        <Button variant="secondary" className="adm-btn-sm" aria-label={D.lowStock.restockAria(p.name)} onClick={() => setRestock(p)}>
          {D.lowStock.restock}
        </Button>
      ),
    },
  ];

  return (
    <>
      {header}

      <div className="adm-stats adm-section">
        <StatCard label={D.kpi.needsAction} value={formatNumber(kpis.needsAction)} hint={D.kpi.needsActionHint(kpis.needsAction)} />
        <StatCard label={D.kpi.salesToday} value={formatMoney(kpis.todayCents)} hint={D.orders(kpis.todayCount)} />
        <StatCard label={D.kpi.lowStock} value={formatNumber(kpis.lowStock)} hint={D.kpi.lowStockHint(kpis.soldOut)} />
        <StatCard label={D.kpi.salesMonth} value={formatMoney(kpis.monthCents)} hint={D.orders(kpis.monthCount)} />
      </div>

      <section className="adm-section" aria-labelledby="dash-decision">
        <div className="adm-page-head adm-subhead">
          <h2 id="dash-decision" ref={decisionHeading} tabIndex={-1} className="adm-h2">{D.decision.title}</h2>
          {queue.total > 0 ? (
            <Link className="adm-btn adm-btn-ghost" href={adminHref("/orders")}>{D.decision.viewAll(queue.total)}</Link>
          ) : null}
        </div>
        <Table
          caption={D.decision.caption}
          rows={queue.rows}
          getKey={(o) => o.id}
          columns={decisionColumns}
          empty={<EmptyState title={D.decision.empty.title} description={D.decision.empty.text} />}
          renderCard={(o) => (
            <div className="adm-pcard">
              <div className="adm-row">{orderLink(o)}</div>
              <div>{o.customer.name}</div>
              {itemsCell(o)}
              <div className="adm-num"><strong>{formatMoney(o.totalCents)}</strong></div>
              {decisionButtons(o)}
            </div>
          )}
        />
      </section>

      <section className="adm-section" aria-labelledby="dash-low">
        <div className="adm-page-head adm-subhead">
          <h2 id="dash-low" ref={lowHeading} tabIndex={-1} className="adm-h2">{D.lowStock.title}</h2>
          <Link className="adm-btn adm-btn-ghost" href={adminHref("/products")}>{D.lowStock.viewAll}</Link>
        </div>
        <Table
          caption={D.lowStock.caption}
          rows={low.slice(0, LOW_LIST_LIMIT)}
          getKey={(p) => p.id}
          columns={lowColumns}
          empty={<EmptyState title={D.lowStock.empty.title} description={D.lowStock.empty.text} />}
          renderCard={(p) => {
            const s = deriveProductStatus(p, threshold);
            return (
              <div className="adm-pcard">
                <Link className="adm-plink" href={adminHref(`/products/${p.id}`)}>{p.name}</Link>
                <div className="adm-row">
                  <StatusBadge kind={s.kind} left={s.total} />
                  <span className="adm-num">{O.pieces(s.total)}</span>
                </div>
                <Button variant="secondary" className="adm-btn-sm" aria-label={D.lowStock.restockAria(p.name)} onClick={() => setRestock(p)}>
                  {D.lowStock.restock}
                </Button>
              </div>
            );
          }}
        />
      </section>

      <section className="adm-section mt-12" aria-labelledby="dash-media">
        <MediaGallery />
      </section>

      <OrderDecisionDialogs
        order={decision?.order ?? null}
        mode={decision?.mode ?? null}
        onClose={() => setDecision(null)}
        onDone={() => { refocus.current = "decision"; }}
      />
      <RestockDialog product={restock} onClose={() => setRestock(null)} onDone={() => { refocus.current = "low"; }} />
    </>
  );
}
