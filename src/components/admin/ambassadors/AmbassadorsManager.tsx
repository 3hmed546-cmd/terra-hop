"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Copy, Plus, RefreshCw } from "lucide-react";
import { PageHeader } from "../PageHeader";
import { Button, Dialog, EmptyState, StatCard, Table, TextInput, useToast, type Column } from "../ui";

interface AmbassadorItem {
  id: string;
  displayName: string;
  fullName: string;
  phone: string;
  email: string;
  instagramHandle: string | null;
  city: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  joinedAt: string;
  code: string;
  codeId: string | null;
  discountPercent: number;
  appliesTo: "ALL_PRODUCTS" | "SELECTED";
  usedCount: number;
  netSales: number;
  pendingSales: number;
  levelName: string;
  levelRank: number;
  firstQualifiedAt: string | null;
}

interface OverviewKPIs {
  totalAmbassadors: number;
  activeAmbassadors: number;
  totalQualifiedSales: number;
  totalPendingSales: number;
  activeRewardsCount: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Detail = any;

const scopeText = (s: AmbassadorItem["appliesTo"]) => (s === "SELECTED" ? "الهوديز فقط" : "كل المنتجات");

function AmbStatus({ status }: { status: AmbassadorItem["status"] }) {
  return status === "ACTIVE" ? (
    <span className="adm-badge adm-badge-available">نشط</span>
  ) : (
    <span className="adm-badge adm-badge-off"><s>موقوف</s></span>
  );
}

function CodeChip({ code, copied, onCopy }: { code: string; copied: boolean; onCopy: () => void }) {
  return (
    <span className="adm-code">
      <span>{code}</span>
      <button type="button" className="adm-icon-btn" onClick={onCopy} aria-label={`نسخ الكود ${code}`}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        <span className="adm-sr">{copied ? "تم النسخ" : "نسخ"}</span>
      </button>
    </span>
  );
}

const EMPTY_FORM = {
  fullName: "",
  displayName: "",
  phone: "",
  email: "",
  instagram: "",
  city: "القاهرة",
  code: "",
  discount: "10",
  appliesTo: "ALL_PRODUCTS" as "ALL_PRODUCTS" | "SELECTED",
  password: "",
};

export function AmbassadorsManager() {
  const toast = useToast();
  const [items, setItems] = useState<AmbassadorItem[]>([]);
  const [overview, setOverview] = useState<OverviewKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [suspendTarget, setSuspendTarget] = useState<AmbassadorItem | null>(null);

  const set = <K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ambassadors", { cache: "no-store" });
      const json = await res.json();
      if (json.ok && json.data) {
        setItems(json.data.items || []);
        setOverview(json.data.overview || null);
      }
    } catch {
      toast.push("فشل تحميل قائمة السفراء.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.push(`تم نسخ ${text}`);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const openDetail = async (id: string) => {
    setDetailId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/ambassadors/${id}`, { cache: "no-store" });
      const json = await res.json();
      if (json.ok && json.data) setDetail(json.data);
      else toast.push(json.message || "تعذر جلب تفاصيل السفير.");
    } catch {
      toast.push("خطأ في الاتصال بالسيرفر.");
    } finally {
      setDetailLoading(false);
    }
  };

  const setStatus = async (item: AmbassadorItem, next: "ACTIVE" | "SUSPENDED") => {
    try {
      const res = await fetch(`/api/admin/ambassadors/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, suspendedReason: next === "SUSPENDED" ? "إيقاف مؤقت بواسطة الأدمن" : "" }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.push(next === "ACTIVE" ? `تم تفعيل ${item.displayName}.` : `تم إيقاف ${item.displayName} مؤقتاً.`);
        load();
      } else toast.push(json.message || "فشل تعديل حالة السفير.");
    } catch {
      toast.push("حدث خطأ أثناء تعديل الحالة.");
    }
  };

  const toggle = (item: AmbassadorItem) => {
    if (item.status === "ACTIVE") setSuspendTarget(item); // suspending is destructive: confirm first
    else setStatus(item, "ACTIVE");
  };

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/ambassadors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          displayName: form.displayName || form.fullName,
          phone: form.phone,
          email: form.email,
          instagramHandle: form.instagram || null,
          city: form.city || null,
          code: form.code || form.fullName.slice(0, 8),
          discountPercent: Number(form.discount) || 10,
          appliesTo: form.appliesTo,
          password: form.password || form.phone,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.push("تم إنشاء السفير وتفعيل كود الخصم.");
        setCreateOpen(false);
        setForm(EMPTY_FORM);
        load();
      } else toast.push(json.message || json.error || "فشل إنشاء السفير.");
    } catch {
      toast.push("حدث خطأ في الاتصال بالخادم.");
    } finally {
      setSubmitting(false);
    }
  };

  const q = search.trim().toLowerCase();
  const rows = items.filter(
    (it) =>
      !q ||
      it.fullName.toLowerCase().includes(q) ||
      it.displayName.toLowerCase().includes(q) ||
      it.code.toLowerCase().includes(q) ||
      it.phone.includes(q) ||
      it.email.toLowerCase().includes(q),
  );

  const columns: Column<AmbassadorItem>[] = [
    {
      key: "who",
      header: "السفير",
      cell: (a) => (
        <div>
          <button type="button" className="adm-plink adm-nav-button" style={{ padding: 0, fontWeight: 600 }} onClick={() => openDetail(a.id)}>
            {a.displayName}
          </button>
          <div className="adm-muted adm-small adm-num">{a.phone} · {a.city || "مصر"}</div>
        </div>
      ),
    },
    {
      key: "code",
      header: "الكود",
      cell: (a) => (
        <div className="adm-stack-sm">
          <CodeChip code={a.code} copied={copiedId === a.id} onCopy={() => copy(a.code, a.id)} />
          <span className="adm-muted adm-small adm-num">استُخدم {a.usedCount} مرة</span>
        </div>
      ),
    },
    {
      key: "disc",
      header: "الخصم",
      cell: (a) => (
        <div>
          <div className="adm-num" style={{ fontWeight: 700 }}>{a.discountPercent}%</div>
          <div className="adm-muted adm-small">{scopeText(a.appliesTo)}</div>
        </div>
      ),
    },
    { key: "status", header: "الحالة", cell: (a) => <AmbStatus status={a.status} /> },
    {
      key: "level",
      header: "المستوى",
      cell: (a) => (
        <div>
          <div style={{ fontWeight: 600 }}>{a.levelName}</div>
          <div className="adm-muted adm-small">رتبة {a.levelRank}</div>
        </div>
      ),
    },
    { key: "net", header: "مؤكدة", align: "end", cell: (a) => <strong className="adm-num">{a.netSales}</strong> },
    { key: "pend", header: "قيد التوصيل", align: "end", cell: (a) => <span className="adm-num">{a.pendingSales}</span> },
    {
      key: "act",
      header: "إجراءات",
      align: "end",
      cell: (a) => (
        <div className="adm-row-links">
          <Button variant="secondary" className="adm-btn-sm" onClick={() => openDetail(a.id)}>التفاصيل</Button>
          <Button variant="ghost" className="adm-btn-sm" onClick={() => toggle(a)}>
            {a.status === "ACTIVE" ? "إيقاف" : "تفعيل"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="سفراء الشارع"
        description="إدارة السفراء وأكواد الخصم. المبيعة تُحتسب للسفير عند تأكيد التسليم والتحصيل فقط، والمكافآت تُفتح تلقائياً."
        actions={
          <>
            <Button variant="secondary" onClick={load} aria-label="تحديث القائمة">
              <RefreshCw className={loading ? "adm-spin" : undefined} aria-hidden="true" />
              <span>تحديث</span>
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" />
              <span>إضافة سفير</span>
            </Button>
          </>
        }
      />

      <section className="adm-section" aria-label="مؤشرات البرنامج">
        {overview ? (
          <div className="adm-stats">
            <StatCard label="إجمالي السفراء" value={String(overview.totalAmbassadors)} hint={`${overview.activeAmbassadors} نشط حالياً`} />
            <StatCard label="مبيعات مؤكدة" value={String(overview.totalQualifiedSales)} hint="تم تسليمها وتحصيلها" />
            <StatCard label="قيد التوصيل" value={String(overview.totalPendingSales)} hint="بانتظار التسليم" />
            <StatCard label="مكافآت ممنوحة" value={String(overview.activeRewardsCount)} hint="هدايا وأكواد 80%" />
          </div>
        ) : (
          <div className="adm-stats">{[0, 1, 2, 3].map((i) => <div key={i} className="adm-skeleton" />)}</div>
        )}
        <p className="adm-muted adm-small" style={{ marginTop: 12 }}>
          رابط دخول السفراء:{" "}
          <a href="/ambassador/login" target="_blank" rel="noreferrer" className="adm-plink" dir="ltr">/ambassador/login</a>
        </p>
      </section>

      <section className="adm-section" aria-labelledby="amb-list-title">
        <h2 id="amb-list-title" className="adm-sr">قائمة السفراء</h2>
        <div className="adm-toolbar adm-toolbar-single">
          <TextInput
            label="بحث"
            hideLabel
            type="search"
            placeholder="ابحث بالاسم، الكود، الموبايل أو البريد"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <p className="adm-results adm-muted adm-small" aria-live="polite">
          {loading ? "جاري التحميل…" : `${rows.length} سفير`}
        </p>
        <Table
          caption="قائمة السفراء"
          columns={columns}
          rows={rows}
          getKey={(a) => a.id}
          renderCard={(a) => (
            <div className="adm-pcard">
              <div className="adm-row" style={{ justifyContent: "space-between", width: "100%" }}>
                <strong>{a.displayName}</strong>
                <AmbStatus status={a.status} />
              </div>
              <CodeChip code={a.code} copied={copiedId === a.id} onCopy={() => copy(a.code, a.id)} />
              <dl className="adm-pcard-facts">
                <div><dt className="adm-label adm-muted">مؤكدة</dt><dd className="adm-num">{a.netSales}</dd></div>
                <div><dt className="adm-label adm-muted">قيد التوصيل</dt><dd className="adm-num">{a.pendingSales}</dd></div>
                <div><dt className="adm-label adm-muted">المستوى</dt><dd>{a.levelName}</dd></div>
                <div><dt className="adm-label adm-muted">الخصم</dt><dd className="adm-num">{a.discountPercent}%</dd></div>
              </dl>
              <div className="adm-actions">
                <Button variant="secondary" className="adm-btn-sm" onClick={() => openDetail(a.id)}>التفاصيل</Button>
                <Button variant="ghost" className="adm-btn-sm" onClick={() => toggle(a)}>{a.status === "ACTIVE" ? "إيقاف" : "تفعيل"}</Button>
              </div>
            </div>
          )}
          empty={
            <EmptyState
              title={q ? "مفيش نتائج" : "لا يوجد سفراء بعد"}
              description={q ? "جرب اسم أو كود تاني." : "أضف أول سفير، وهيتولد له كود خصم وحساب دخول للبورتال فوراً."}
              action={!q ? <Button onClick={() => setCreateOpen(true)}><Plus aria-hidden="true" /><span>إضافة سفير</span></Button> : undefined}
            />
          }
        />
      </section>

      {/* ---------- create ---------- */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="إضافة سفير جديد"
        description="هيتم إنشاء ملف السفير، كود الخصم، وحساب دخول البورتال مرة واحدة."
      >
        <form onSubmit={submitCreate} className="adm-amb-wide" noValidate={false}>
          <fieldset className="adm-fieldset adm-form-section">
            <legend className="adm-label adm-muted">البيانات الشخصية</legend>
            <div className="adm-form-grid">
              <TextInput
                label="الاسم بالكامل"
                required
                placeholder="أحمد محمد علي"
                value={form.fullName}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => ({ ...f, fullName: v, displayName: f.displayName || v.split(" ")[0] }));
                }}
              />
              <TextInput label="اسم العرض" placeholder="أحمد" value={form.displayName} onChange={(e) => set("displayName", e.target.value)} />
              <TextInput label="موبايل (واتساب)" required dir="ltr" inputMode="tel" placeholder="01012345678" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              <TextInput label="البريد الإلكتروني" required type="email" dir="ltr" placeholder="name@mail.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
              <TextInput label="إنستغرام" hint="اختياري" dir="ltr" placeholder="@handle" value={form.instagram} onChange={(e) => set("instagram", e.target.value)} />
              <TextInput label="المحافظة / المدينة" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
          </fieldset>

          <fieldset className="adm-fieldset adm-form-section">
            <legend className="adm-label adm-muted">كود الخصم</legend>
            <div className="adm-form-grid">
              <TextInput label="الكود" required dir="ltr" placeholder="AHMED10" value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s+/g, ""))} />
              <TextInput label="خصم العميل (%)" type="number" min={1} max={100} dir="ltr" value={form.discount} onChange={(e) => set("discount", e.target.value)} />
            </div>
            <div className="adm-radios" role="radiogroup" aria-label="نطاق الخصم">
              <label className="adm-check">
                <input type="radio" name="appliesTo" checked={form.appliesTo === "ALL_PRODUCTS"} onChange={() => set("appliesTo", "ALL_PRODUCTS")} />
                <span className="adm-check-text"><strong>كل المنتجات</strong></span>
              </label>
              <label className="adm-check">
                <input type="radio" name="appliesTo" checked={form.appliesTo === "SELECTED"} onChange={() => set("appliesTo", "SELECTED")} />
                <span className="adm-check-text"><strong>الهوديز فقط</strong><span className="adm-field-hint">الموصى به</span></span>
              </label>
            </div>
          </fieldset>

          <fieldset className="adm-fieldset adm-form-section">
            <legend className="adm-label adm-muted">دخول البورتال</legend>
            <TextInput
              label="كلمة المرور المبدئية"
              hint="لو سبتها فاضية هتبقى رقم الموبايل."
              dir="ltr"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
            />
          </fieldset>

          <div className="adm-dialog-foot">
            <Button type="submit" disabled={submitting}>{submitting ? "جاري الحفظ…" : "حفظ وإنشاء السفير"}</Button>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>إلغاء</Button>
          </div>
        </form>
      </Dialog>

      {/* ---------- confirm suspend ---------- */}
      <Dialog
        open={Boolean(suspendTarget)}
        onClose={() => setSuspendTarget(null)}
        title={`إيقاف ${suspendTarget?.displayName ?? ""}؟`}
        description="الكود هيتوقف عن العمل في الدفع فوراً، والسفير مش هيقدر يدخل البورتال. المبيعات المحتسبة تفضل محفوظة، وتقدر تفعّله تاني في أي وقت."
        footer={
          <>
            <Button
              onClick={() => {
                if (suspendTarget) setStatus(suspendTarget, "SUSPENDED");
                setSuspendTarget(null);
              }}
            >
              إيقاف السفير
            </Button>
            <Button variant="secondary" onClick={() => setSuspendTarget(null)}>إلغاء</Button>
          </>
        }
      />

      {/* ---------- detail ---------- */}
      <Dialog open={Boolean(detailId)} onClose={() => setDetailId(null)} title="ملف السفير">
        <div className="adm-amb-wide">
          {detailLoading || !detail ? (
            <div className="adm-skeleton" role="status" aria-label="جاري التحميل" />
          ) : (
            <>
              <div className="adm-amb-head">
                <div>
                  <h3 className="adm-h2">{detail.ambassador.fullName}</h3>
                  <div className="adm-muted adm-small adm-num" dir="ltr" style={{ textAlign: "right" }}>
                    {detail.ambassador.phone} · {detail.ambassador.email}
                  </div>
                </div>
                <div className="adm-row">
                  <span className="adm-badge">المستوى: {detail.ambassador.levelName}</span>
                  <span className="adm-badge adm-num">{detail.ambassador.netSales} مبيعة مؤكدة</span>
                </div>
              </div>

              <section aria-labelledby="d-codes">
                <h4 id="d-codes" className="adm-h3">أكواد الخصم</h4>
                <ul className="adm-amb-list">
                  {detail.codes.map((c: any) => (
                    <li key={c.id}>
                      <div className="adm-row">
                        <CodeChip code={c.code} copied={copiedId === c.id} onCopy={() => copy(c.code, c.id)} />
                        <span className="adm-num" style={{ fontWeight: 700 }}>{c.discountPercent}%</span>
                        <span className="adm-muted adm-small">{scopeText(c.appliesTo)}</span>
                      </div>
                      <span className="adm-muted adm-small adm-num">استُخدم {c.usedCount} مرة</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="d-rewards">
                <h4 id="d-rewards" className="adm-h3">المكافآت الممنوحة</h4>
                {detail.rewards.length === 0 ? (
                  <p className="adm-muted adm-nomargin">لم يحصل على مكافآت بعد.</p>
                ) : (
                  <ul className="adm-amb-list">
                    {detail.rewards.map((r: any) => (
                      <li key={r.id}>
                        <div className="adm-stack-sm">
                          <strong>{r.title}</strong>
                          <span className="adm-muted adm-small">{r.description}</span>
                          {r.voucher?.code ? (
                            <span className="adm-row" style={{ gap: 8 }}>
                              <span className="adm-code" style={{ paddingInlineEnd: 10 }}>{r.voucher.code}</span>
                              <span className={`adm-badge ${r.voucher.status === "REDEEMED" ? "adm-badge-off" : "adm-badge-available"}`}>
                                {r.voucher.status === "REDEEMED" ? <s>مستخدم</s> : "متاح"}
                              </span>
                            </span>
                          ) : null}
                        </div>
                        <span className="adm-muted adm-small adm-num">{new Date(r.earnedAt).toLocaleDateString("ar-EG")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="d-orders">
                <h4 id="d-orders" className="adm-h3">الطلبات المنسوبة</h4>
                {detail.orders.length === 0 ? (
                  <p className="adm-muted adm-nomargin">لا توجد طلبات بعد.</p>
                ) : (
                  <ul className="adm-amb-list">
                    {detail.orders.map((o: any) => (
                      <li key={o.id}>
                        <div>
                          <strong className="adm-num">{o.number}</strong>
                          <span className="adm-muted adm-small"> · {o.customerName}</span>
                        </div>
                        <div className="adm-row">
                          <span className="adm-num">{o.total} ج.م</span>
                          <span className={`adm-badge ${o.fulfilmentStatus === "DELIVERED" ? "adm-badge-sold" : "adm-badge-amb"}`}>
                            {o.fulfilmentStatus === "DELIVERED" ? "تم التسليم والتحصيل" : "قيد التوصيل"}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="d-timeline">
                <h4 id="d-timeline" className="adm-h3">سجل الأحداث</h4>
                {detail.milestones.length === 0 ? (
                  <p className="adm-muted adm-nomargin">لا توجد أحداث مسجلة بعد.</p>
                ) : (
                  <ol className="adm-timeline">
                    {detail.milestones.map((m: any) => (
                      <li key={m.id}>
                        <div className="adm-timeline-title">{m.description}</div>
                        <div className="adm-muted adm-small adm-num">
                          {new Date(m.occurred_at).toLocaleString("ar-EG")} · {m.created_by}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          )}
        </div>
        <div className="adm-dialog-foot">
          <Button variant="secondary" onClick={() => setDetailId(null)}>إغلاق</Button>
        </div>
      </Dialog>
    </>
  );
}
