"use client";
import { useState } from "react";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";
import { formatMoney } from "@/lib/admin/format";
import { deriveProductStatus } from "@/lib/admin/inventory";
import { useAdminStore } from "@/lib/admin/store";
import type { Product } from "@/lib/admin/types";
import { PageHeader } from "./PageHeader";
import {
  Button, Checkbox, Dialog, EmptyState, NumberInput, Select, StatCard, StatusBadge, Table, Tabs, Textarea, TextInput,
  useToast, type BadgeKind,
} from "./ui";

const KINDS: BadgeKind[] = ["available", "low", "sold_out", "draft", "PENDING_EMAIL", "AWAITING_APPROVAL", "SOLD", "CANCELLED", "EXPIRED"];

/** Dev-only gallery of the shared components (not available in production builds). */
export function ComponentsPreview() {
  const { data } = useAdminStore();
  const toast = useToast();
  const [tab, setTab] = useState("one");
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<number | null>(5);
  const [price, setPrice] = useState<number | null>(450);

  const rows: Product[] = data?.products ?? [];
  const threshold = data?.settings.lowStockThreshold ?? 3;

  return (
    <>
      <PageHeader title="Components" description="Dev-only preview of the shared admin components." />

      <section className="adm-section">
        <h2 className="adm-h2">Buttons</h2>
        <div className="adm-row">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Disabled</Button>
        </div>
      </section>

      <section className="adm-section">
        <h2 className="adm-h2">Status badges</h2>
        <div className="adm-row">
          {KINDS.map((k) => <StatusBadge key={k} kind={k} left={3} />)}
        </div>
      </section>

      <section className="adm-section">
        <h2 className="adm-h2">Stat cards</h2>
        <div className="adm-stats">
          <StatCard label="Needs action" value="3" hint="Orders waiting for you" />
          <StatCard label="Sales today" value={formatMoney(236000)} hint="2 orders" />
        </div>
      </section>

      <section className="adm-section adm-stack">
        <h2 className="adm-h2">Fields</h2>
        <div className="adm-grid-2">
          <TextInput label="Name" required placeholder="Oversized Tee" />
          <TextInput label="Slug" hint="Generated from the name" error="Slug is already used" defaultValue="oversized-tee" />
          <Select label="Category" options={[{ value: "tshirt", label: "T-shirt" }, { value: "hoodie", label: "Hoodie" }, { value: "other", label: "Other" }]} />
          <NumberInput label="Price" prefix="EGP" decimal value={price} onChange={setPrice} min={0} />
          <NumberInput label="Stock" value={qty} onChange={setQty} min={0} hint="Whole pieces" error={qty === null ? "Enter a number" : undefined} />
        </div>
        <Textarea label="Description" hint="Shown on the product page" />
        <Checkbox label="Force sold out" hint="Hide stock and show SOLD OUT even if pieces remain" />
      </section>

      <section className="adm-section">
        <h2 className="adm-h2">Tabs</h2>
        <Tabs label="Example tabs" value={tab} onChange={setTab} items={[{ id: "one", label: "Needs action", count: 3 }, { id: "two", label: "Sold", count: 4 }, { id: "three", label: "All" }]}>
          <p className="adm-muted">Selected tab: {tab}. Use the arrow keys, Home and End.</p>
        </Tabs>
      </section>

      <section className="adm-section">
        <h2 className="adm-h2">Table (cards below 768px)</h2>
        <Table
          caption="Products"
          rows={rows}
          getKey={(p) => p.id}
          columns={[
            { key: "name", header: "Name", cell: (p) => p.name },
            { key: "price", header: "Price", align: "end", cell: (p) => formatMoney(p.priceCents) },
            { key: "status", header: "Status", cell: (p) => { const s = deriveProductStatus(p, threshold); return <StatusBadge kind={s.kind} left={s.total} />; } },
          ]}
          renderCard={(p) => {
            const s = deriveProductStatus(p, threshold);
            return (
              <div className="adm-stack">
                <strong>{p.name}</strong>
                <span className="adm-num">{formatMoney(p.priceCents)}</span>
                <StatusBadge kind={s.kind} left={s.total} />
              </div>
            );
          }}
          empty={<EmptyState title="No products yet" description="Add your first product to see it here." />}
        />
      </section>

      <section className="adm-section">
        <h2 className="adm-h2">Dialog and toast</h2>
        <div className="adm-row">
          <Button variant="secondary" onClick={() => setOpen(true)}>Open dialog</Button>
          <Button variant="secondary" onClick={() => toast.push("Product saved")}>Show toast</Button>
        </div>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Mark order as sold?"
          description="This deducts 3 pieces from stock."
          footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{ADMIN_STRINGS.common.cancel}</Button><Button onClick={() => { setOpen(false); toast.push("Order marked as sold"); }}>Mark as sold</Button></>}
        />
      </section>
    </>
  );
}
