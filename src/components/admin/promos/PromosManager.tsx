"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import {
  Tag,
  Plus,
  Search,
  Copy,
  Check,
  Power,
  Trash2,
  Ticket,
  Percent,
  Layers,
  Sparkles,
} from "lucide-react";
import { apiFetch } from "@/lib/admin-auth";
import { useAdminStore, reloadAdminData } from "@/lib/admin/store";
import {
  Button,
  Dialog,
  StatCard,
  TextInput,
  useToast,
  EmptyState,
} from "@/components/admin/ui";

export interface PromoItem {
  code: string;
  kind: "percent" | "fixed";
  value: number;
  active: boolean;
  startsAt: string | null;
  expiresAt: string | null;
  maxUses: number | null;
  used: number;
  minSubtotalCents: number;
  appliesTo: "ALL_PRODUCTS" | "SELECTED";
  selectedProductIds: string[];
}

export interface PromoOverview {
  totalCodes: number;
  activeCodes: number;
  totalUses: number;
}

const EMPTY_FORM = {
  code: "",
  kind: "percent" as "percent" | "fixed",
  value: "10",
  maxUses: "",
  minSubtotal: "",
  expiresAt: "",
  appliesTo: "ALL_PRODUCTS" as "ALL_PRODUCTS" | "SELECTED",
};

export function PromosManager() {
  const toast = useToast();
  const { data: adminData } = useAdminStore();
  const products = adminData?.products || [];

  const [items, setItems] = useState<PromoItem[]>([]);
  const [overview, setOverview] = useState<PromoOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PromoItem | null>(null);
  const [viewProductsTarget, setViewProductsTarget] = useState<PromoItem | null>(null);

  const set = <K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/promos", { cache: "no-store" });
      const json = await res.json();
      if (json.ok && json.data) {
        setItems(json.data.items || []);
        setOverview(json.data.overview || null);
      }
    } catch {
      toast.push("فشل تحميل قائمة أكواد الخصم.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.push(`تم نسخ الكود: ${code}`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    reloadAdminData().catch(() => {});
    setSelectedProductIds(products.map((p) => p.id));
    setCreateOpen(true);
  };

  const generateRandomCode = () => {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    let randomLetters = "";
    for (let i = 0; i < 4; i++) {
      randomLetters += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    const randomDigits = Math.floor(10 + Math.random() * 90);
    set("code", `HOP${randomLetters}${randomDigits}`);
  };

  const toggleStatus = async (item: PromoItem) => {
    const nextActive = !item.active;
    setItems((prev) => prev.map((it) => (it.code === item.code ? { ...it, active: nextActive } : it)));
    try {
      const res = await apiFetch(`/api/admin/promos/${encodeURIComponent(item.code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.push(nextActive ? `تم تفعيل الكود ${item.code}.` : `تم إيقاف الكود ${item.code} مؤقتاً.`);
        load();
      } else {
        setItems((prev) => prev.map((it) => (it.code === item.code ? { ...it, active: !nextActive } : it)));
        toast.push(json.message || "فشل تعديل حالة الكود.");
      }
    } catch {
      setItems((prev) => prev.map((it) => (it.code === item.code ? { ...it, active: !nextActive } : it)));
      toast.push("حدث خطأ أثناء تعديل الحالة.");
    }
  };

  const submitDelete = async (item: PromoItem) => {
    try {
      const res = await apiFetch(`/api/admin/promos/${encodeURIComponent(item.code)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.ok) {
        toast.push(`تم حذف كود الخصم ${item.code} بنجاح.`);
        setDeleteTarget(null);
        setItems((prev) => prev.filter((it) => it.code !== item.code));
        setOverview((prev) =>
          prev
            ? {
                ...prev,
                totalCodes: Math.max(0, prev.totalCodes - 1),
                activeCodes: item.active ? Math.max(0, prev.activeCodes - 1) : prev.activeCodes,
              }
            : null
        );
        load();
      } else {
        toast.push(json.message || json.error?.message || "فشل حذف كود الخصم.");
      }
    } catch {
      toast.push("حدث خطأ أثناء محاولة الحذف.");
    }
  };

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (form.appliesTo === "SELECTED" && selectedProductIds.length === 0) {
      toast.push("يرجى اختيار منتج واحد على الأقل مشمول في كود الخصم.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/admin/promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          kind: form.kind,
          value: Number(form.value) || 0,
          maxUses: form.maxUses ? Number(form.maxUses) : null,
          minSubtotalCents: form.minSubtotal ? Math.round(Number(form.minSubtotal) * 100) : 0,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
          appliesTo: form.appliesTo,
          eligibleProductIds: form.appliesTo === "SELECTED" ? selectedProductIds : [],
        }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.push("تم إنشاء كود الخصم بنجاح.");
        setCreateOpen(false);
        setForm(EMPTY_FORM);
        load();
      } else {
        toast.push(json.message || json.error || "فشل إنشاء كود الخصم.");
      }
    } catch {
      toast.push("حدث خطأ في الاتصال بالخادم.");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = items.filter((it) => {
    if (!search.trim()) return true;
    return it.code.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="adm-page adm-ambassadors" style={{ gap: 24 }}>
      {/* 1. Header */}
      <div className="adm-page-head" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
        <div style={{ flex: "1 1 280px" }}>
          <h1 className="adm-h1">أكواد الخصم والبرومو</h1>
          <p className="adm-muted" style={{ marginTop: 4 }}>
            إدارة وإنشاء أكواد الخصم وتطبيق نظام القيود والشروط (قيمة الخصم، حد الاستخدام، والمنتجات المشمولة).
          </p>
        </div>
        <Button
          variant="primary"
          onClick={openCreate}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 42 }}
        >
          <Plus style={{ width: 16, height: 16 }} />
          <span>إنشاء كود خصم جديد</span>
        </Button>
      </div>

      {/* 2. Top Stats KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="إجمالي الأكواد"
          value={String(overview?.totalCodes ?? 0)}
          hint="جميع الأكواد المسجلة"
        />
        <StatCard
          label="الأكواد الفعّالة"
          value={String(overview?.activeCodes ?? 0)}
          hint="جاهزة للاستخدام عند الدفع"
        />
        <StatCard
          label="إجمالي مرات الاستخدام"
          value={String(overview?.totalUses ?? 0)}
          hint="عدد الطلبات المطبقة بكود"
        />
      </div>

      {/* 3. Search and Actions */}
      <div className="adm-card" style={{ padding: 14 }}>
        <div className="adm-toolbar" style={{ flexWrap: "wrap", gap: 10 }}>
          <div className="adm-search" style={{ flex: "1 1 260px", maxWidth: "100%" }}>
            <Search className="adm-search-icon" aria-hidden="true" />
            <input
              type="search"
              className="adm-input"
              placeholder="ابحث عن كود الخصم..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* 4. Promo Codes List (Responsive: Mobile Cards + Desktop Table) */}
      <div className="adm-card" style={{ overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center" }} className="adm-muted">
            جاري تحميل أكواد الخصم…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={search ? "لا توجد نتائج تطابق بحثك" : "لا توجد أكواد خصم مسجلة حتى الآن"}
            description={
              search
                ? "تأكد من كتابة الكود بشكل صحيح."
                : "قم بإنشاء أول كود خصم وحدد قيمة الخصم ونطاق المنتجات المشمولة."
            }
            action={
              !search ? (
                <Button
                  variant="primary"
                  onClick={openCreate}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <Plus style={{ width: 16, height: 16 }} />
                  <span>إنشاء كود خصم جديد</span>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Mobile Card View (ظهور بطاقات واضحة ومنسقة بالكامل على شاشات الموبايل) */}
            <div className="block md:hidden divide-y divide-stone-200">
              {filtered.map((item) => {
                const isExpired = item.expiresAt && new Date(item.expiresAt) < new Date();
                const isMaxed = item.maxUses && item.used >= item.maxUses;
                const isAvailable = item.active && !isExpired && !isMaxed;

                return (
                  <div key={item.code} className="p-4 space-y-3.5 bg-white">
                    {/* السطر الأول: الكود مع زر النسخ + شارة الحالة */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 bg-stone-100/90 px-3 py-1.5 rounded-lg border border-stone-200">
                        <strong className="font-mono text-sm tracking-wide text-obsidian">
                          {item.code}
                        </strong>
                        <button
                          type="button"
                          className="text-stone-500 hover:text-stone-900 p-1 transition-colors"
                          onClick={() => copy(item.code)}
                          title="نسخ الكود"
                        >
                          {copiedCode === item.code ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                          isAvailable
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {isExpired
                          ? "منتهي الصلاحية"
                          : isMaxed
                          ? "مستنفد"
                          : item.active
                          ? "نشط"
                          : "متوقف"}
                      </span>
                    </div>

                    {/* السطر الثاني: قيمة الخصم ونظام الشروط والمنتجات */}
                    <div className="flex items-center justify-between gap-2 bg-stone-50/80 p-3 rounded-xl border border-stone-100">
                      <div>
                        <span className="text-[11px] text-stone-500 block mb-0.5">قيمة الخصم</span>
                        <strong className="text-lg text-[#c8102e] font-black tracking-tight">
                          {item.kind === "percent" ? `${item.value}%` : `${item.value} ج.م`}
                        </strong>
                        <span className="text-[11px] text-stone-500 block">
                          {item.kind === "percent" ? "خصم نسبي مئوي" : "خصم نقدي ثابت"}
                        </span>
                      </div>

                      <div className="text-left">
                        <span className="text-[11px] text-stone-500 block mb-1">المنتجات المشمولة</span>
                        {item.appliesTo === "ALL_PRODUCTS" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                            <Layers className="w-3.5 h-3.5" />
                            كل المنتجات
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200"
                            onClick={() => setViewProductsTarget(item)}
                          >
                            محددة ({item.selectedProductIds?.length || 0})
                          </button>
                        )}
                      </div>
                    </div>

                    {/* السطر الثالث: تفاصيل الاستخدام والحد الأدنى */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-100">
                        <span className="text-[11px] text-stone-400 block mb-0.5">مرات الاستخدام</span>
                        <span className={`font-bold ${isMaxed ? "text-rose-600" : "text-stone-800"}`}>
                          {item.used} {item.maxUses ? `/ ${item.maxUses}` : "(غير محدود)"}
                        </span>
                      </div>

                      <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-100">
                        <span className="text-[11px] text-stone-400 block mb-0.5">الحد الأدنى للطلب</span>
                        <span className="font-bold text-stone-800">
                          {item.minSubtotalCents > 0
                            ? `${Math.round(item.minSubtotalCents / 100)} ج.م`
                            : "لا يوجد"}
                        </span>
                      </div>
                    </div>

                    {/* السطر الرابع: أزرار التحكم والإجراءات بحجم مريح للمس */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => toggleStatus(item)}
                        className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                          item.active
                            ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{item.active ? "إيقاف مؤقت" : "تفعيل الكود"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        className="py-2.5 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-all cursor-pointer"
                        title="حذف الكود نهائياً"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (على الشاشات الكبيرة >= 768px) */}
            <div className="adm-table-wrap hidden md:block" style={{ overflowX: "auto" }}>
              <table className="adm-table" style={{ width: "100%", minWidth: 700 }}>
                <thead>
                  <tr>
                    <th>كود الخصم</th>
                    <th>قيمة الخصم</th>
                    <th>نظام القيود والشروط (المنتجات)</th>
                    <th>مرات الاستخدام</th>
                    <th>الحد الأدنى</th>
                    <th>الحالة</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const isExpired = item.expiresAt && new Date(item.expiresAt) < new Date();
                    const isMaxed = item.maxUses && item.used >= item.maxUses;
                    const isAvailable = item.active && !isExpired && !isMaxed;

                    return (
                      <tr key={item.code}>
                        <td>
                          <span className="adm-code">
                            <strong style={{ fontFamily: "var(--font-mono)", fontSize: "0.95rem" }}>
                              {item.code}
                            </strong>
                            <button
                              type="button"
                              className="adm-icon-btn"
                              onClick={() => copy(item.code)}
                              title="نسخ الكود"
                            >
                              {copiedCode === item.code ? <Check className="text-emerald-500" /> : <Copy />}
                            </button>
                          </span>
                        </td>

                        <td>
                          <strong className="adm-num" style={{ color: "#c8102e", fontSize: "0.95rem" }}>
                            {item.kind === "percent" ? `${item.value}%` : `${item.value} ج.م`}
                          </strong>
                          <span className="adm-muted" style={{ display: "block", fontSize: "0.75rem" }}>
                            {item.kind === "percent" ? "خصم نسبي" : "خصم نقدي ثابت"}
                          </span>
                        </td>

                        <td>
                          {item.appliesTo === "ALL_PRODUCTS" ? (
                            <span className="adm-badge adm-badge-available" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Layers style={{ width: 12, height: 12 }} />
                              كل منتجات المتجر
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="adm-badge"
                              style={{
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                background: "rgba(168, 85, 247, 0.12)",
                                border: "1px solid #a855f7",
                                color: "#7e22ce",
                                fontWeight: 700,
                              }}
                              onClick={() => setViewProductsTarget(item)}
                              title="عرض المنتجات المشمولة"
                            >
                              منتجات محددة ({item.selectedProductIds?.length || 0})
                            </button>
                          )}
                        </td>

                        <td>
                          <span className="adm-num">
                            {item.used}
                            {item.maxUses ? ` / ${item.maxUses}` : " (غير محدود)"}
                          </span>
                          {isMaxed && (
                            <span className="adm-muted" style={{ color: "#ef4444", display: "block", fontSize: "0.75rem" }}>
                              تم استنفاد الحد
                            </span>
                          )}
                        </td>

                        <td>
                          <span className="adm-num">
                            {item.minSubtotalCents > 0
                              ? `${Math.round(item.minSubtotalCents / 100)} ج.م`
                              : "لا يوجد"}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`adm-badge ${isAvailable ? "adm-badge-available" : "adm-badge-cancelled"}`}
                          >
                            {isExpired
                              ? "منتهي الصلاحية"
                              : isMaxed
                              ? "مستنفد"
                              : item.active
                              ? "نشط"
                              : "متوقف"}
                          </span>
                        </td>

                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Button
                              variant="secondary"
                              title={item.active ? "إيقاف الكود" : "تفعيل الكود"}
                              onClick={() => toggleStatus(item)}
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px" }}
                            >
                              <Power style={{ width: 14, height: 14, color: item.active ? "#ef4444" : "#22c55e" }} />
                              <span>{item.active ? "إيقاف" : "تفعيل"}</span>
                            </Button>
                            <Button
                              variant="secondary"
                              title="حذف الكود"
                              onClick={() => setDeleteTarget(item)}
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px" }}
                            >
                              <Trash2 style={{ width: 14, height: 14, color: "#dc2626" }} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* 5. Create Promo Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="إنشاء كود خصم جديد"
        description="حدد كود الخصم ونوع الخصم وشروط التطبيق (نظام القيود والشروط والمنتجات المشمولة)."
      >
        <form onSubmit={submitCreate} className="adm-form" style={{ marginTop: 12 }}>
          <fieldset className="adm-fieldset">
            <legend className="adm-legend">بيانات الكود والخصم</legend>

            <div className="adm-form-grid">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <TextInput
                      label="رمز الكود (Code)"
                      required
                      dir="ltr"
                      placeholder="مثال: SUMMER20"
                      value={form.code}
                      onChange={(e) =>
                        set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={generateRandomCode}
                    title="توليد كود تلقائي عشوائي"
                    style={{ marginBottom: 2, height: 38 }}
                  >
                    <Sparkles style={{ width: 14, height: 14, marginLeft: 4 }} />
                    توليد
                  </Button>
                </div>
              </div>

              <div>
                <label className="adm-label" style={{ marginBottom: 6, display: "block" }}>
                  نوع الخصم
                </label>
                <div className="adm-radios" style={{ display: "flex", gap: 12, marginTop: 4 }}>
                  <label className="adm-check" style={{ flex: 1 }}>
                    <input
                      type="radio"
                      name="promoKind"
                      checked={form.kind === "percent"}
                      onChange={() => set("kind", "percent")}
                    />
                    <span className="adm-check-text">
                      <strong>نسبة مئوية (%)</strong>
                    </span>
                  </label>
                  <label className="adm-check" style={{ flex: 1 }}>
                    <input
                      type="radio"
                      name="promoKind"
                      checked={form.kind === "fixed"}
                      onChange={() => set("kind", "fixed")}
                    />
                    <span className="adm-check-text">
                      <strong>مبلغ ثابت (ج.م)</strong>
                    </span>
                  </label>
                </div>
              </div>

              <TextInput
                label={form.kind === "percent" ? "قيمة الخصم (%)" : "قيمة الخصم (ج.م)"}
                required
                type="number"
                min={1}
                max={form.kind === "percent" ? 100 : 10000}
                dir="ltr"
                placeholder={form.kind === "percent" ? "مثال: 15" : "مثال: 100"}
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
              />

              <TextInput
                label="حد الاستخدام الأقصى (مرات)"
                hint="اتركه فارغاً للاستخدام غير المحدود."
                type="number"
                min={1}
                dir="ltr"
                placeholder="مثال: 50"
                value={form.maxUses}
                onChange={(e) => set("maxUses", e.target.value)}
              />

              <TextInput
                label="الحد الأدنى لقيمة الطلب (ج.م)"
                hint="اختياري - يطبق الخصم إذا تخطى الطلب هذه القيمة."
                type="number"
                min={0}
                dir="ltr"
                placeholder="مثال: 500"
                value={form.minSubtotal}
                onChange={(e) => set("minSubtotal", e.target.value)}
              />

              <TextInput
                label="تاريخ انتهاء الصلاحية"
                hint="اختياري - اتركه فارغاً لصلاحية مفتوحة."
                type="date"
                dir="ltr"
                value={form.expiresAt}
                onChange={(e) => set("expiresAt", e.target.value)}
              />
            </div>

            {/* نظام القيود والشروط على المنتجات (Restrictions) */}
            <div className="adm-radios" role="radiogroup" aria-label="نطاق تطبيق الخصم" style={{ marginTop: 18 }}>
              <label className="adm-check">
                <input
                  type="radio"
                  name="appliesTo"
                  checked={form.appliesTo === "ALL_PRODUCTS"}
                  onChange={() => set("appliesTo", "ALL_PRODUCTS")}
                />
                <span className="adm-check-text">
                  <strong>كل المنتجات</strong>
                  <span className="adm-field-hint">يطبق الخصم على أي منتج يضاف لسلة المشتريات</span>
                </span>
              </label>

              <label className="adm-check">
                <input
                  type="radio"
                  name="appliesTo"
                  checked={form.appliesTo === "SELECTED"}
                  onChange={() => {
                    set("appliesTo", "SELECTED");
                    if (selectedProductIds.length === 0 && products.length > 0) {
                      setSelectedProductIds(products.map((p) => p.id));
                    }
                  }}
                />
                <span className="adm-check-text">
                  <strong>منتجات محددة (إظهار وتحديد المنتجات المتضمنة للكود)</strong>
                  <span className="adm-field-hint">يطبق الخصم فقط وحصرياً على المنتجات التي تختارها أدناه</span>
                </span>
              </label>
            </div>

            {form.appliesTo === "SELECTED" && (
              <div className="adm-product-picker" style={{ marginTop: 12 }}>
                <div className="adm-product-picker-header">
                  <div>
                    <span className="adm-label" style={{ fontWeight: 700 }}>
                      المنتجات المشمولة في كود الخصم ({selectedProductIds.length} من {products.length})
                    </span>
                    <span className="adm-field-hint">الخصم سيُحسب فقط على المنتجات المحددة</span>
                  </div>
                  <div className="adm-product-picker-actions">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setSelectedProductIds(products.map((p) => p.id))}
                    >
                      تحديد الكل
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setSelectedProductIds([])}
                    >
                      إلغاء التحديد
                    </Button>
                  </div>
                </div>

                {products.length === 0 ? (
                  <p className="adm-muted" style={{ padding: 12 }}>
                    لا توجد منتجات مسجلة في المتجر حالياً.
                  </p>
                ) : (
                  <div className="adm-product-picker-list" style={{ maxHeight: 280, overflowY: "auto" }}>
                    {products.map((p) => {
                      const isSelected = selectedProductIds.includes(p.id);
                      const thumb = p.images?.[0]?.url;
                      return (
                        <label
                          key={p.id}
                          className={`adm-product-picker-item ${isSelected ? "is-selected" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedProductIds((prev) => [...prev, p.id]);
                              } else {
                                setSelectedProductIds((prev) => prev.filter((id) => id !== p.id));
                              }
                            }}
                          />
                          {thumb && (
                            <img src={thumb} alt={p.name} className="adm-product-picker-thumb" />
                          )}
                          <div className="adm-product-picker-info">
                            <span className="adm-product-picker-name">{p.name}</span>
                            <span className="adm-product-picker-meta adm-muted adm-num">
                              {Math.round((p.priceCents || 0) / 100)} ج.م · {p.category}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </fieldset>

          <div className="adm-dialog-foot">
            <Button type="submit" disabled={submitting}>
              {submitting ? "جاري الحفظ…" : "حفظ وإنشاء كود الخصم"}
            </Button>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              إلغاء
            </Button>
          </div>
        </form>
      </Dialog>

      {/* 6. View Scoped Products Dialog */}
      <Dialog
        open={Boolean(viewProductsTarget)}
        onClose={() => setViewProductsTarget(null)}
        title={`المنتجات المشمولة في الكود ${viewProductsTarget?.code ?? ""}`}
        description="قائمة بالمنتجات التي يسري عليها الخصم فقط عند إضافتها للسلة:"
      >
        <div style={{ maxHeight: 360, overflowY: "auto", marginTop: 12 }}>
          {products
            .filter((p) => viewProductsTarget?.selectedProductIds?.includes(p.id))
            .map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "8px 12px",
                  borderBottom: "1px solid var(--adm-border, #e5e7eb)",
                }}
              >
                {p.images?.[0]?.url && (
                  <img
                    src={p.images[0].url}
                    alt={p.name}
                    style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover" }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div className="adm-muted" style={{ fontSize: "0.8rem" }}>
                    {Math.round((p.priceCents || 0) / 100)} ج.م
                  </div>
                </div>
              </div>
            ))}
        </div>
        <div className="adm-dialog-foot">
          <Button variant="secondary" onClick={() => setViewProductsTarget(null)}>
            إغلاق
          </Button>
        </div>
      </Dialog>

      {/* 7. Confirm Delete Dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`حذف كود الخصم ${deleteTarget?.code ?? ""}؟`}
        description="سيتم حذف الكود نهائياً ولن يتمكن أي عميل من استخدامه مرة أخرى. هل أنت متأكد؟"
        footer={
          <>
            <Button
              variant="primary"
              style={{ backgroundColor: "#dc2626" }}
              onClick={() => deleteTarget && submitDelete(deleteTarget)}
            >
              نعم، احذف الكود
            </Button>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              إلغاء
            </Button>
          </>
        }
      />
    </div>
  );
}
