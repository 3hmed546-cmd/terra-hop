"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useDebounce } from "@/lib/use-debounce";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";
import { formatDateTime, formatMoney } from "@/lib/admin/format";
import {
  countOrderTabs,
  itemsSummary,
  orderPieces,
  ORDER_TABS,
  queryOrders,
  type OrderTab,
  type SimulatedKind,
} from "@/lib/admin/orders";
import { adminHref } from "@/lib/admin/paths";
import { useAdminStore } from "@/lib/admin/store";
import type { Order } from "@/lib/admin/types";
import { PageHeader } from "../PageHeader";
import { Button, EmptyState, StatusBadge, Table, Tabs, TextInput, useToast, type Column } from "../ui";

const S = ADMIN_STRINGS.orders;

function OrderLink({ order }: { order: Order }) {
  return (
    <Link className="adm-plink adm-num" href={adminHref(`/orders/${order.id}`)} aria-label={S.viewAria(order.number)}>
      {order.number}
    </Link>
  );
}

function CustomerCell({ order }: { order: Order }) {
  return (
    <div>
      <div>{order.customer.name}</div>
      {order.customer.phone ? <div className="adm-muted adm-small adm-num">{order.customer.phone}</div> : null}
      {order.ambassadorCode ? (
        <div style={{ marginTop: "3px" }}>
          <span style={{ fontSize: "10px", padding: "1px 6px", borderRadius: "3px", backgroundColor: "#2A1800", color: "#FBBF24", border: "1px solid #78350F" }}>
            سفير: {order.ambassadorCode}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function ItemsCell({ order }: { order: Order }) {
  const { first, more } = itemsSummary(order);
  return (
    <div>
      <div>{first}</div>
      <div className="adm-muted adm-small">
        {more > 0 ? `${S.more(more)} · ` : ""}
        {S.pieces(orderPieces(order))}
      </div>
    </div>
  );
}

export function OrdersList() {
  const { data, ready, actions } = useAdminStore();
  const toast = useToast();
  const [tab, setTab] = useState<OrderTab>("needs_action");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);

  const orders = data?.orders;
  const counts = useMemo(() => (orders ? countOrderTabs(orders) : null), [orders]);
  const visible = useMemo(
    () => (orders ? queryOrders(orders, { tab, search: debouncedSearch }) : []),
    [orders, tab, debouncedSearch],
  );

  const simulate = (kind: SimulatedKind) => {
    const result = actions.simulateOrder(kind);
    if (!result.ok) {
      toast.push(ADMIN_STRINGS.errors[result.error]);
      return;
    }
    setSearch("");
    setTab(kind === "awaiting" ? "needs_action" : "pending_email");
    toast.push(kind === "awaiting" ? S.preview.createdAwaiting(result.number) : S.preview.createdPending(result.number));
  };

  const header = (
    <PageHeader
      title={ADMIN_STRINGS.pages.orders.title}
      description={ADMIN_STRINGS.pages.orders.summary}
      actions={
        <div className="adm-row" role="group" aria-label={S.preview.legend}>
          <Button variant="secondary" onClick={() => simulate("awaiting")}>
            {S.preview.awaiting}
          </Button>
          <Button variant="secondary" onClick={() => simulate("pending")}>
            {S.preview.pending}
          </Button>
        </div>
      }
    />
  );

  if (!ready || !data || !counts) {
    return (
      <>
        {header}
        <div className="adm-skeleton" role="status">
          <span className="adm-sr">{ADMIN_STRINGS.common.loading}</span>
        </div>
      </>
    );
  }

  if (data.orders.length === 0) {
    return (
      <>
        {header}
        <EmptyState title={S.empty.title} description={S.empty.description} />
      </>
    );
  }

  const columns: Column<Order>[] = [
    { key: "order", header: S.columns.order, cell: (o) => <OrderLink order={o} /> },
    { key: "date", header: S.columns.date, cell: (o) => <span className="adm-num">{formatDateTime(o.createdAt)}</span> },
    { key: "customer", header: S.columns.customer, cell: (o) => <CustomerCell order={o} /> },
    { key: "items", header: S.columns.items, cell: (o) => <ItemsCell order={o} /> },
    { key: "total", header: S.columns.total, align: "end", cell: (o) => <span className="adm-num">{formatMoney(o.totalCents)}</span> },
    { key: "source", header: S.columns.source, cell: (o) => S.source[o.source] },
    { key: "status", header: S.columns.status, cell: (o) => <StatusBadge kind={o.status} /> },
  ];

  const renderCard = (o: Order) => (
    <div className="adm-pcard">
      <div className="adm-row">
        <OrderLink order={o} />
        <StatusBadge kind={o.status} />
      </div>
      <CustomerCell order={o} />
      <ItemsCell order={o} />
      <dl className="adm-pcard-facts">
        <div>
          <dt className="adm-label adm-muted">{S.columns.total}</dt>
          <dd className="adm-num">{formatMoney(o.totalCents)}</dd>
        </div>
        <div>
          <dt className="adm-label adm-muted">{S.columns.source}</dt>
          <dd>{S.source[o.source]}</dd>
        </div>
      </dl>
      <div className="adm-muted adm-small adm-num">{formatDateTime(o.createdAt)}</div>
    </div>
  );

  const tabTotal = counts[tab];
  const emptyCopy = S.emptyTab[tab];

  return (
    <>
      {header}
      <p className="adm-muted adm-small">{S.preview.note}</p>

      <div className="adm-toolbar adm-toolbar-single">
        <TextInput
          label={S.searchLabel}
          type="search"
          placeholder={S.searchPlaceholder}
          value={search}
          autoComplete="off"
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Tabs
        label={S.tabsLabel}
        value={tab}
        onChange={(id) => setTab(id as OrderTab)}
        items={ORDER_TABS.map((id) => ({ id, label: S.tabs[id], count: counts[id] }))}
      >
        <p role="status" className="adm-results adm-muted">
          {S.results(visible.length, tabTotal)}
        </p>
        <Table
          caption={S.tableCaption}
          columns={columns}
          rows={visible}
          getKey={(o) => o.id}
          renderCard={renderCard}
          empty={
            search.trim() !== "" && tabTotal > 0 ? (
              <EmptyState
                title={S.noMatch.title}
                description={S.noMatch.description}
                action={
                  <Button variant="secondary" onClick={() => setSearch("")}>
                    {S.noMatch.action}
                  </Button>
                }
              />
            ) : (
              <EmptyState title={emptyCopy.title} description={emptyCopy.description} />
            )
          }
        />
      </Tabs>
    </>
  );
}
