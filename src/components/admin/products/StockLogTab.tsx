"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/admin/ui/Button";
import { Dialog } from "@/components/admin/ui/Dialog";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { NumberInput } from "@/components/admin/ui/NumberInput";
import { Select } from "@/components/admin/ui/Select";
import { Table, type Column } from "@/components/admin/ui/Table";
import { TextInput } from "@/components/admin/ui/TextInput";
import { useToast } from "@/components/admin/ui/Toast";
import { formatDateTime } from "@/lib/admin/format";
import { adminHref } from "@/lib/admin/paths";
import { useAdminStore } from "@/lib/admin/store";
import type { Product, StockMovement, StockReason } from "@/lib/admin/types";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";

const REASON_LABELS: Record<StockReason, { label: string; badgeClass: string }> = {
  sale: { label: "بيع", badgeClass: "bg-obsidian text-off-white" },
  cancel_restock: { label: "إلغاء وإعادة للمخزن", badgeClass: "bg-line-light text-obsidian" },
  manual_adjust: { label: "تعديل جرد يدوي", badgeClass: "bg-line-light text-charcoal" },
  initial: { label: "مخزون افتتاحي", badgeClass: "bg-line-light/60 text-graphite" },
};

export function StockLogTab({ product }: { product: Product }) {
  const { data, actions } = useAdminStore();
  const toast = useToast();

  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState(product.variants[0]?.id ?? "");
  const [newStock, setNewStock] = useState<number>(() => product.variants[0]?.stock ?? 0);
  const [adjustNote, setAdjustNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Variant lookup
  const variantMap = useMemo(() => {
    const map = new Map<string, { color: string; size: string; currentStock: number }>();
    for (const v of product.variants) {
      const color = product.colors.find((c) => c.id === v.colorId)?.name ?? "أساسي";
      map.set(v.id, { color, size: v.size, currentStock: v.stock });
    }
    return map;
  }, [product]);

  // Movements for this product
  const movements = useMemo(() => {
    if (!data?.movements) return [];
    return data.movements
      .filter((m) => m.productId === product.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data, product.id]);

  function handleSelectVariant(variantId: string) {
    setSelectedVariantId(variantId);
    const v = product.variants.find((v) => v.id === variantId);
    if (v) setNewStock(v.stock);
  }

  function handleSaveAdjust() {
    if (!selectedVariantId) return;
    if (newStock < 0) {
      toast.push("لا يمكن أن يكون المخزون سالباً.");
      return;
    }
    if (!adjustNote.trim()) {
      toast.push("يرجى كتابة سبب أو ملاحظة لتعديل المخزون.");
      return;
    }

    setSaving(true);
    const res = actions.adjustStock(selectedVariantId, newStock, adjustNote.trim());
    if (res.ok) {
      toast.push("تم تعديل المخزون بنجاح.");
      setIsAdjustOpen(false);
      setAdjustNote("");
    } else {
      toast.push(`تعذر تعديل المخزون: ${ADMIN_STRINGS.errors[res.error] || res.error}`);
    }
    setSaving(false);
  }

  const columns: Column<StockMovement>[] = [
    {
      key: "date",
      header: "التاريخ والوقت",
      cell: (m) => <span className="text-xs text-graphite">{formatDateTime(m.createdAt)}</span>,
    },
    {
      key: "variant",
      header: "اللون والمقاس",
      cell: (m) => {
        const info = variantMap.get(m.variantId);
        return (
          <span className="text-xs font-medium text-obsidian">
            {info ? `${info.color} · مقاس ${info.size}` : m.variantId}
          </span>
        );
      },
    },
    {
      key: "delta",
      header: "حركة المخزون",
      cell: (m) => (
        <span
          className={`font-mono text-xs font-bold ${
            m.delta > 0 ? "text-emerald-700" : m.delta < 0 ? "text-red-600" : "text-graphite"
          }`}
        >
          {m.delta > 0 ? `+${m.delta}` : m.delta} قطعة
        </span>
      ),
    },
    {
      key: "balance",
      header: "الرصيد",
      cell: (m) => (
        <span className="font-mono text-xs text-charcoal">
          {m.before} → <strong>{m.after}</strong>
        </span>
      ),
    },
    {
      key: "reason",
      header: "السبب والتفاصيل",
      cell: (m) => {
        const r = REASON_LABELS[m.reason] ?? { label: m.reason, badgeClass: "bg-line-light text-charcoal" };
        return (
          <div>
            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${r.badgeClass}`}>
              {r.label}
            </span>
            {m.orderId && (
              <div className="mt-0.5">
                <Link
                  href={adminHref(`/orders/${m.orderId}`)}
                  className="text-[11px] font-mono text-obsidian underline"
                >
                  الطلب #{m.orderId}
                </Link>
              </div>
            )}
            {m.note && <div className="text-[11px] text-graphite italic mt-0.5">&ldquo;{m.note}&rdquo;</div>}
          </div>
        );
      },
    },
  ];

  const renderCard = (m: StockMovement) => {
    const info = variantMap.get(m.variantId);
    const r = REASON_LABELS[m.reason] ?? { label: m.reason, badgeClass: "bg-line-light text-charcoal" };
    return (
      <div className="adm-pcard text-xs">
        <div className="flex items-center justify-between">
          <span className="font-medium text-obsidian">
            {info ? `${info.color} · مقاس ${info.size}` : m.variantId}
          </span>
          <span
            className={`font-mono font-bold ${
              m.delta > 0 ? "text-emerald-700" : m.delta < 0 ? "text-red-600" : "text-graphite"
            }`}
          >
            {m.delta > 0 ? `+${m.delta}` : m.delta} قطعة
          </span>
        </div>
        <div className="flex items-center justify-between text-graphite">
          <span>{formatDateTime(m.createdAt)}</span>
          <span className="font-mono">
            الرصيد: {m.before} → <strong>{m.after}</strong>
          </span>
        </div>
        <div className="pt-2 border-t border-line-light">
          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${r.badgeClass}`}>
            {r.label}
          </span>
          {m.orderId && (
            <Link
              href={adminHref(`/orders/${m.orderId}`)}
              className="mr-2 font-mono text-obsidian underline text-[11px]"
            >
              الطلب #{m.orderId}
            </Link>
          )}
          {m.note && <div className="text-graphite italic mt-1">&ldquo;{m.note}&rdquo;</div>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded border border-line-light bg-off-white p-4">
        <div>
          <h3 className="text-sm font-bold text-obsidian">سجل حركات الجرد وتدقيق المخزون</h3>
          <p className="text-xs text-graphite">
            كل حركة تتم على المخزون (مبيعات، إلغاءات، توريدات جديدة) تُسجل في هذا الجدول بالتاريخ والسبب.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            const first = product.variants[0];
            if (first) {
              setSelectedVariantId(first.id);
              setNewStock(first.stock);
            }
            setIsAdjustOpen(true);
          }}
          className="bg-obsidian text-off-white hover:bg-charcoal text-xs py-2 px-3.5 cursor-pointer"
        >
          + تزويد مخزون / تعديل يدوي
        </Button>
      </div>

      <Table<StockMovement>
        caption="سجل حركات المخزون"
        columns={columns}
        rows={movements}
        getKey={(m) => m.id}
        renderCard={renderCard}
        empty={
          <EmptyState
            title="لا توجد حركات مسجلة بعد"
            description="حركات المخزون ستظهر هنا فور تسجيل مبيعات أو توريدات لهذا المنتج."
          />
        }
      />

      {/* Quick Restock / Stock Adjustment Dialog */}
      <Dialog
        open={isAdjustOpen}
        onClose={() => setIsAdjustOpen(false)}
        title={`تعديل مخزون: ${product.name}`}
      >
        <div className="space-y-4">
          <Select
            label="اللون والمقاس المراد تعديله"
            value={selectedVariantId}
            onChange={(e) => handleSelectVariant(e.target.value)}
            options={product.variants.map((v) => {
              const color = product.colors.find((c) => c.id === v.colorId)?.name ?? "أساسي";
              return {
                value: v.id,
                label: `${color} · مقاس ${v.size} (الحالي: ${v.stock} قطعة)`,
              };
            })}
          />

          <NumberInput
            label="الكمية الجديدة في المستودع"
            value={newStock}
            min={0}
            onChange={(n) => setNewStock(n ?? 0)}
            hint="حدد العدد الفعلي للقطع المتوفرة في المستودع حالياً."
          />

          <TextInput
            label="سبب التعديل أو التوريد (مطلوب)"
            placeholder="مثال: شحنة جديدة من المصنع، إعادة جرد سنوي، مرتجع عميل..."
            value={adjustNote}
            onChange={(e) => setAdjustNote(e.target.value)}
            required
          />

          <div className="flex justify-end gap-3 pt-3">
            <Button type="button" variant="secondary" onClick={() => setIsAdjustOpen(false)}>
              إلغاء
            </Button>
            <Button
              type="button"
              disabled={saving || !adjustNote.trim()}
              onClick={handleSaveAdjust}
              className="cursor-pointer"
            >
              {saving ? "جاري الحفظ…" : "حفظ التعديل"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
