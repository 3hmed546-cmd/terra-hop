"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";
import { formatDateTime, formatMoney } from "@/lib/admin/format";
import { checkOrderStock } from "@/lib/admin/inventory";
import { canCancel, lineTotal, sellBlockReason } from "@/lib/admin/orders";
import { adminHref } from "@/lib/admin/paths";
import { useAdminStore } from "@/lib/admin/store";
import { apiFetch } from "@/lib/admin-auth";
import type { Order, OrderItem, TimelineEvent } from "@/lib/admin/types";
import { PageHeader } from "../PageHeader";
import { Button, EmptyState, StatusBadge, Table, useToast, type Column } from "../ui";
import { OrderDecisionDialogs } from "./OrderDecisionDialogs";

const S = ADMIN_STRINGS.orders.detail;
const STATUS_TEXT = ADMIN_STRINGS.status;

const statusText = (o: Order): string =>
  ({
    PENDING_EMAIL: STATUS_TEXT.pendingEmail,
    AWAITING_APPROVAL: STATUS_TEXT.needsAction,
    PROCESSING: STATUS_TEXT.processing,
    SOLD: STATUS_TEXT.sold,
    CANCELLED: STATUS_TEXT.cancelled,
    EXPIRED: STATUS_TEXT.expired,
  })[o.status];

function placedLine(o: Order): string {
  const parts = [S.placed(formatDateTime(o.createdAt))];
  if (o.source === "manual") parts.push(S.manualSale);
  else if (o.waConfirmedAt) parts.push("مؤكد عبر الواتساب 🟢");
  else if (o.emailConfirmedAt) parts.push(S.emailConfirmed(formatDateTime(o.emailConfirmedAt)));
  else if (o.status === "PENDING_EMAIL") parts.push(S.emailWaiting);
  return parts.join(" · ");
}

function EventRow({ event, order }: { event: TimelineEvent; order: Order }) {
  const T = S.timeline;
  const note = event.note ? T.reason(event.note) : null;
  const returned = event.type === "cancelled" && order.soldAt !== null;
  return (
    <li>
      <div className="adm-timeline-title">{T.events[event.type]}</div>
      <div className="adm-muted adm-small adm-num">
        {formatDateTime(event.at)} · {T.actors[event.actor]}
      </div>
      {note ? <div className="adm-small">{note}</div> : null}
      {returned ? <div className="adm-small">{T.stockReturned}</div> : null}
    </li>
  );
}

export function OrderDetail({ orderId }: { orderId: string }) {
  const { data, ready, actions, reload } = useAdminStore();
  const toast = useToast();
  const [dialog, setDialog] = useState<"confirm" | "deliver" | "sell" | "cancel" | null>(null);
  const [delivering, setDelivering] = useState(false);
  const [resending, setResending] = useState(false);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const refocus = useRef(false);

  const handleResendEmail = async (targetOrderId: string) => {
    setResending(true);
    try {
      const res = await apiFetch(`/api/admin/orders/${targetOrderId}/resend-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.ok) {
        toast.push(json.data?.message || "تم إرسال الفاتورة ورابط التأكيد للعميل بنجاح.");
      } else {
        toast.push(json.message || "فشل إرسال الإيميل.");
      }
    } catch {
      toast.push("خطأ في الاتصال بالخادم.");
    } finally {
      setResending(false);
    }
  };

  const handleMarkDeliveredPaid = async (targetOrderId: string) => {
    setDelivering(true);
    try {
      const res = await apiFetch(`/api/admin/orders/${targetOrderId}/mark-delivered-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.ok) {
        toast.push(json.data?.message || "تم تأكيد التسليم والتحصيل واحتساب المبيعة للسفير بنجاح!");
        reload?.();
      } else {
        toast.push(json.message || "فشل تأكيد التسليم والتحصيل.");
      }
    } catch {
      toast.push("خطأ في الاتصال بالخادم.");
    } finally {
      setDelivering(false);
    }
  };

  // After a decision the buttons that opened the dialog disappear: move focus to the status line.
  useEffect(() => {
    if (dialog === null && refocus.current) {
      refocus.current = false;
      statusRef.current?.focus();
    }
  }, [dialog]);

  const backLink = (
    <Link className="adm-btn adm-btn-secondary" href={adminHref("/orders")}>
      {S.back}
    </Link>
  );

  if (!ready || !data) {
    return (
      <>
        <PageHeader title={ADMIN_STRINGS.pages.orderDetail.title} />
        <div className="adm-skeleton" role="status">
          <span className="adm-sr">{ADMIN_STRINGS.common.loading}</span>
        </div>
      </>
    );
  }

  const order = data.orders.find((o) => o.id === orderId);
  if (!order) {
    return (
      <>
        <PageHeader title={ADMIN_STRINGS.pages.orderDetail.title} />
        <EmptyState title={S.notFound.title} description={S.notFound.text} action={backLink} />
      </>
    );
  }

  const awaiting = order.status === "AWAITING_APPROVAL";
  const stockLines = awaiting ? checkOrderStock(data, order) : [];
  const blocked = sellBlockReason(data, order) === "insufficient_stock";
  const openSell = () => {
    if (!blocked) setDialog("sell");
  };

  // After a decision the buttons that opened the dialog disappear: move focus to the status line.
  const decided = () => {
    refocus.current = true;
  };

  const simulate = (kind: "confirm" | "expire") => {
    const result = kind === "confirm" ? actions.confirmOrderEmail(order.id) : actions.expireOrder(order.id);
    toast.push(
      result.ok
        ? kind === "confirm"
          ? S.previewBox.confirmed(order.number)
          : S.previewBox.expired(order.number)
        : ADMIN_STRINGS.errors[result.error],
    );
    refocus.current = true;
    setDialog(null);
  };

  const itemColumns: Column<OrderItem>[] = [
    {
      key: "item",
      header: S.items.item,
      cell: (i) => (
        <div>
          <div>{i.productName}</div>
          <div className="adm-muted adm-small">
            {i.colorName} · {i.size}
          </div>
        </div>
      ),
    },
    { key: "qty", header: S.items.qty, align: "end", cell: (i) => <span className="adm-num">{i.qty}</span> },
    { key: "unit", header: S.items.unit, align: "end", cell: (i) => <span className="adm-num">{formatMoney(i.priceCentsSnapshot)}</span> },
    { key: "line", header: S.items.line, align: "end", cell: (i) => <span className="adm-num">{formatMoney(lineTotal(i))}</span> },
  ];

  const renderItemCard = (i: OrderItem) => (
    <div className="adm-pcard">
      <div>
        <div>{i.productName}</div>
        <div className="adm-muted adm-small">
          {i.colorName} · {i.size}
        </div>
      </div>
      <dl className="adm-pcard-facts">
        <div>
          <dt className="adm-label adm-muted">{S.items.qty}</dt>
          <dd className="adm-num">{i.qty}</dd>
        </div>
        <div>
          <dt className="adm-label adm-muted">{S.items.unit}</dt>
          <dd className="adm-num">{formatMoney(i.priceCentsSnapshot)}</dd>
        </div>
        <div>
          <dt className="adm-label adm-muted">{S.items.line}</dt>
          <dd className="adm-num">{formatMoney(lineTotal(i))}</dd>
        </div>
      </dl>
    </div>
  );

  const subtotal = order.items.reduce((sum, i) => sum + lineTotal(i), 0);
  const phoneHref = `tel:${order.customer.phone.replace(/\s+/g, "")}`;
  const processing = order.status === "PROCESSING";
  const decisionNote = awaiting
    ? S.decision.needsNote
    : processing
      ? S.decision.processingNote
      : order.status === "SOLD"
        ? S.decision.soldNote
        : order.status === "PENDING_EMAIL"
          ? S.decision.pendingNote
          : S.decision.closed;

  return (
    <>
      <PageHeader title={S.title(order.number)} description={placedLine(order)} actions={<StatusBadge kind={order.status} />} />
      <p ref={statusRef} tabIndex={-1} role="status" className="adm-sr-focus">
        {S.statusLine(statusText(order))}
      </p>

      <div className="adm-order-grid">
        <div className="adm-stack">
          <section className="adm-card" aria-labelledby="ord-items">
            <h2 id="ord-items" className="adm-h2">{S.items.title}</h2>
            <Table caption={S.items.caption} columns={itemColumns} rows={order.items} getKey={(i) => i.variantId} renderCard={renderItemCard} />
            <dl className="adm-totals">
              <div>
                <dt>{S.items.subtotal}</dt>
                <dd className="adm-num">{formatMoney(subtotal)}</dd>
              </div>
              <div>
                <dt>{S.items.shipping}</dt>
                <dd className="adm-num">{formatMoney(order.shippingCents)}</dd>
              </div>
              <div className="is-total">
                <dt>{S.items.total}</dt>
                <dd className="adm-num">{formatMoney(order.totalCents)}</dd>
              </div>
            </dl>
          </section>

          {awaiting ? (
            <section className="adm-card" aria-labelledby="ord-stock">
              <h2 id="ord-stock" className="adm-h2">{S.stock.title}</h2>
              <p className="adm-muted">{S.stock.intro}</p>
              <ul className="adm-stock-lines">
                {stockLines.map((line) => (
                  <li key={line.variantId} className={line.ok ? undefined : "is-short"}>
                    <div>
                      <div>{line.label} <span className="adm-num">× {line.requested}</span></div>
                      <div className="adm-muted adm-small adm-num">
                        {line.ok ? S.stock.line(line.inStock, line.after) : S.stock.lineShort(line.inStock, line.available)}
                      </div>
                      {line.reservedByOthers > 0 ? <div className="adm-muted adm-small">{S.stock.reserved(line.reservedByOthers)}</div> : null}
                    </div>
                    <strong className="adm-stock-flag">
                      <span aria-hidden="true">{line.ok ? "✓ " : "✗ "}</span>
                      {line.ok ? S.stock.ok : S.stock.short(line.requested - line.available)}
                    </strong>
                  </li>
                ))}
              </ul>
            </section>
          ) : order.status === "PENDING_EMAIL" ? (
            <section className="adm-card" aria-labelledby="ord-stock">
              <h2 id="ord-stock" className="adm-h2">{S.stock.title}</h2>
              <p className="adm-muted">{S.stock.pending}</p>
            </section>
          ) : null}

          <section className="adm-card" aria-labelledby="ord-decision">
            <h2 id="ord-decision" className="adm-h2">{S.decision.title}</h2>
            <p className="adm-muted">{decisionNote}</p>
            {awaiting ? (
              <>
                <div className="adm-decision">
                  <Button
                    aria-disabled={blocked ? true : undefined}
                    aria-describedby={blocked ? "sell-blocked" : undefined}
                    onClick={() => setDialog("confirm")}
                  >
                    تأكيد الأوردر وبدء الشحن
                  </Button>
                  <Button variant="secondary" onClick={() => setDialog("cancel")}>
                    {S.decision.cancel}
                  </Button>
                </div>
                {blocked ? <p id="sell-blocked" className="adm-warn">{S.decision.blocked}</p> : null}
              </>
            ) : order.status === "PENDING_EMAIL" ? (
              <div className="adm-decision">
                <Button
                  style={{ backgroundColor: "#0284c7", color: "#ffffff" }}
                  onClick={() => simulate("confirm")}
                >
                  اعتماد وتأكيد الطلب يدوياً (نقل إلى يتطلب قراراً)
                </Button>
                <Button variant="secondary" onClick={() => setDialog("cancel")}>
                  {S.decision.cancel}
                </Button>
              </div>
            ) : processing ? (
              <div className="adm-decision">
                <Button
                  style={{ backgroundColor: "#10b981", color: "#ffffff" }}
                  onClick={() => setDialog("deliver")}
                >
                  اكتمال تسليم الأوردر
                </Button>
                <Button variant="secondary" onClick={() => setDialog("cancel")}>
                  {S.decision.cancel}
                </Button>
              </div>
            ) : canCancel(order) ? (
              <div className="adm-decision">
                <Button variant="secondary" onClick={() => setDialog("cancel")}>
                  {S.decision.cancel}
                </Button>
              </div>
            ) : null}

            {/* Street Ambassador & COD fulfilment */}
            <div className="adm-fulfil">
              <div className="adm-row" style={{ justifyContent: "space-between" }}>
                <span className="adm-label adm-muted">التسليم والتحصيل · دفع عند الاستلام</span>
                {order.fulfilmentStatus === "DELIVERED" ? (
                  <span className="adm-badge adm-badge-sold">تم التسليم والتحصيل</span>
                ) : (
                  <span className="adm-badge adm-badge-amb">قيد الشحن والتوصيل</span>
                )}
              </div>

              {order.ambassadorCode ? (
                <p className="adm-fulfil-note adm-nomargin">
                  منسوب لسفير الشارع <strong dir="ltr">{order.ambassadorCode}</strong>. تُحتسب له المبيعة عند تأكيد التسليم.
                </p>
              ) : null}

              {order.fulfilmentStatus !== "DELIVERED" && order.status !== "CANCELLED" ? (
                <div>
                  <Button disabled={delivering} aria-busy={delivering} onClick={() => handleMarkDeliveredPaid(order.id)}>
                    {delivering ? "جاري التأكيد…" : "تأكيد التسليم والتحصيل"}
                  </Button>
                </div>
              ) : null}
            </div>
          </section>

          {order.status === "PENDING_EMAIL" ? (
            <section className="adm-preview-box" aria-labelledby="ord-preview">
              <h2 id="ord-preview" className="adm-h3">تأكيد البريد الإلكتروني</h2>
              <p className="adm-nomargin adm-muted">
                الطلب بانتظار ضغط العميل على رابط «تأكيد الأوردر» في رسالة البريد الإلكتروني ليصبح جاهزاً للشحن والموافقة.
              </p>
              <div className="adm-row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                <Button variant="secondary" disabled={resending} onClick={() => handleResendEmail(order.id)}>
                  {resending ? "جاري الإرسال…" : "إعادة إرسال إيميل الفاتورة والتأكيد"}
                </Button>
                <Button variant="secondary" onClick={() => simulate("confirm")}>{S.previewBox.confirm}</Button>
              </div>
            </section>
          ) : null}
        </div>

        <div className="adm-stack">
          <section className="adm-card" aria-labelledby="ord-customer">
            <h2 id="ord-customer" className="adm-h2">{S.customer.title}</h2>
            <dl className="adm-dl">
              <dt>{S.customer.name}</dt>
              <dd>{order.customer.name}</dd>
              {order.customer.phone ? (
                <>
                  <dt>{S.customer.phone}</dt>
                  <dd><a href={phoneHref} className="adm-num">{order.customer.phone}</a></dd>
                </>
              ) : null}
              {order.customer.email ? (
                <>
                  <dt>{S.customer.email}</dt>
                  <dd><a href={`mailto:${order.customer.email}`}>{order.customer.email}</a></dd>
                </>
              ) : null}
              {order.customer.address ? (
                <>
                  <dt>{S.customer.address}</dt>
                  <dd>{[order.customer.address, order.customer.city].filter(Boolean).join(", ")}</dd>
                </>
              ) : null}
              <dt>{S.customer.source}</dt>
              <dd>{ADMIN_STRINGS.orders.source[order.source]}</dd>
              {order.notes ? (
                <>
                  <dt>{S.customer.notes}</dt>
                  <dd>{order.notes}</dd>
                </>
              ) : null}
            </dl>
          </section>

          <section className="adm-card" aria-labelledby="ord-timeline">
            <details open>
              <summary id="ord-timeline" className="adm-h2 adm-summary-toggle">{S.timeline.title}</summary>
              <ol className="adm-timeline" aria-label={S.timeline.label}>
                {order.timeline.map((event, index) => (
                  <EventRow key={`${event.type}-${event.at}-${index}`} event={event} order={order} />
                ))}
              </ol>
            </details>
          </section>
        </div>
      </div>

      <div className="adm-row">{backLink}</div>

      <OrderDecisionDialogs order={order} mode={dialog} onClose={() => setDialog(null)} onDone={decided} />
    </>
  );
}
