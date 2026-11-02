"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  Award,
  TrendingUp,
  Package,
  Sparkles,
  Plus,
  Copy,
  Check,
  Eye,
  ShieldAlert,
  ShieldCheck,
  Search,
  ExternalLink,
  RefreshCw,
  Clock,
  Tag,
  CheckCircle2,
} from "lucide-react";
import { PageHeader } from "../PageHeader";
import { Button, Dialog, useToast } from "../ui";

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

export function AmbassadorsManager() {
  const toast = useToast();
  const [items, setItems] = useState<AmbassadorItem[]>([]);
  const [overview, setOverview] = useState<OverviewKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAmbassadorId, setSelectedAmbassadorId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Create form state
  const [formFullName, setFormFullName] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formInstagram, setFormInstagram] = useState("");
  const [formCity, setFormCity] = useState("القاهرة");
  const [formCode, setFormCode] = useState("");
  const [formDiscount, setFormDiscount] = useState("10");
  const [formAppliesTo, setFormAppliesTo] = useState<"ALL_PRODUCTS" | "SELECTED">("ALL_PRODUCTS");
  const [formPassword, setFormPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchAmbassadors = useCallback(async () => {
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
    fetchAmbassadors();
  }, [fetchAmbassadors]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleOpenDetail = async (id: string) => {
    setSelectedAmbassadorId(id);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await fetch(`/api/admin/ambassadors/${id}`, { cache: "no-store" });
      const json = await res.json();
      if (json.ok && json.data) {
        setDetailData(json.data);
      } else {
        toast.push(json.message || "تعذر جلب تفاصيل السفير.");
      }
    } catch {
      toast.push("خطأ في الاتصال بالسيرفر.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleToggleStatus = async (item: AmbassadorItem) => {
    const nextStatus = item.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const reason = nextStatus === "SUSPENDED" ? "إيقاف مؤقت بواسطة الأدمن" : "";
    try {
      const res = await fetch(`/api/admin/ambassadors/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, suspendedReason: reason }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.push(nextStatus === "ACTIVE" ? "تم تفعيل السفير." : "تم إيقاف السفير مؤقتاً.");
        fetchAmbassadors();
      } else {
        toast.push(json.message || "فشل تعديل حالة السفير.");
      }
    } catch {
      toast.push("حدث خطأ أثناء تعديل الحالة.");
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/ambassadors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formFullName,
          displayName: formDisplayName || formFullName,
          phone: formPhone,
          email: formEmail,
          instagramHandle: formInstagram || null,
          city: formCity || null,
          code: formCode || formFullName.slice(0, 8),
          discountPercent: Number(formDiscount) || 10,
          appliesTo: formAppliesTo,
          password: formPassword || formPhone,
        }),
      });

      const json = await res.json();
      if (json.ok) {
        toast.push("تم إنشاء السفير وتفعيل كود الخصم المشفر بنجاح!");
        setShowCreateModal(false);
        // Reset form
        setFormFullName("");
        setFormDisplayName("");
        setFormPhone("");
        setFormEmail("");
        setFormInstagram("");
        setFormCode("");
        setFormPassword("");
        fetchAmbassadors();
      } else {
        toast.push(json.message || json.error || "فشل إنشاء السفير.");
      }
    } catch {
      toast.push("حدث خطأ في الاتصال بالخادم.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredItems = items.filter((it) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      it.fullName.toLowerCase().includes(q) ||
      it.displayName.toLowerCase().includes(q) ||
      it.code.toLowerCase().includes(q) ||
      it.phone.includes(q) ||
      it.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="adm-stack" dir="rtl">
      <PageHeader
        title="برنامج سفراء الشارع (Street Ambassador Program)"
        description="إدارة السفراء، أكواد الخصم المشفرة، احتساب المبيعات المؤكدة عند التسليم، ومتابعة مكافآت الـ 80%."
        actions={
          <div className="adm-row">
            <Button variant="primary" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 ml-1.5" />
              <span>+ إضافة سفير جديد</span>
            </Button>
            <Button variant="secondary" onClick={fetchAmbassadors} aria-label="تحديث">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      {/* KPI Overview Cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="adm-card p-4">
            <div className="flex items-center justify-between text-white/50 text-xs mb-1">
              <span>إجمالي السفراء</span>
              <Users className="w-4 h-4 text-white/60" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">{overview.totalAmbassadors}</div>
            <div className="text-[11px] text-white/40 mt-1">{overview.activeAmbassadors} سفير نشط حالياً</div>
          </div>

          <div className="adm-card p-4">
            <div className="flex items-center justify-between text-emerald-400 text-xs mb-1">
              <span>المبيعات المؤكدة (المحتسبة)</span>
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400">{overview.totalQualifiedSales}</div>
            <div className="text-[11px] text-white/40 mt-1">تم تسليمها وتحصيلها</div>
          </div>

          <div className="adm-card p-4">
            <div className="flex items-center justify-between text-sky-400 text-xs mb-1">
              <span>طلبات قيد التوصيل</span>
              <Package className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold font-mono text-sky-400">{overview.totalPendingSales}</div>
            <div className="text-[11px] text-white/40 mt-1">بانتظار التسليم والتحصيل</div>
          </div>

          <div className="adm-card p-4">
            <div className="flex items-center justify-between text-purple-400 text-xs mb-1">
              <span>المكافآت الممنوحة</span>
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold font-mono text-purple-400">{overview.activeRewardsCount}</div>
            <div className="text-[11px] text-white/40 mt-1">أكواد 80% وهدايا مفتوحة</div>
          </div>

          <div className="adm-card p-4">
            <div className="flex items-center justify-between text-amber-400 text-xs mb-1">
              <span>بورتال السفراء</span>
              <ExternalLink className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-white mt-1">رابط دخول السفير:</div>
            <a
              href="/ambassador/login"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-mono text-amber-400 underline mt-1 inline-block hover:text-amber-300"
            >
              /ambassador/login
            </a>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="adm-card p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="ابحث باسم السفير، الكود، رقم الهاتف أو البريد..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg px-4 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-white"
            />
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-3 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Ambassadors Table */}
      <div className="adm-card overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center text-white/50 text-sm">
            <Users className="w-10 h-10 text-white/20 mx-auto mb-2" />
            <p>لا يوجد سفراء مسجلين يطابقون البحث.</p>
            <p className="text-xs text-white/40 mt-1">اضغط على زر "+ إضافة سفير جديد" لإنشاء أول سفير.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#141414] text-white/60 border-b border-[#242424]">
                <tr>
                  <th className="p-3.5">السفير</th>
                  <th className="p-3.5">كود الخصم</th>
                  <th className="p-3.5">الخصم والنطاق</th>
                  <th className="p-3.5">الحالة</th>
                  <th className="p-3.5">المستوى</th>
                  <th className="p-3.5 text-center">المبيعات المؤكدة</th>
                  <th className="p-3.5 text-center">قيد التوصيل</th>
                  <th className="p-3.5 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242424]">
                {filteredItems.map((amb) => (
                  <tr key={amb.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-white text-sm">{amb.displayName}</div>
                      <div className="text-white/40 text-[11px] font-mono">{amb.phone} &bull; {amb.city || "مصر"}</div>
                    </td>

                    <td className="p-3.5">
                      <div className="inline-flex items-center gap-1.5 bg-[#0D0D0D] border border-[#333] px-2.5 py-1 rounded font-mono font-bold text-white text-sm">
                        <span>{amb.code}</span>
                        <button
                          onClick={() => handleCopy(amb.code, amb.id)}
                          className="text-white/50 hover:text-white"
                          title="نسخ الكود"
                        >
                          {copiedCode === amb.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <div className="text-[10px] text-white/40 mt-0.5 font-mono">استخدم {amb.usedCount} مرة</div>
                    </td>

                    <td className="p-3.5">
                      <div className="font-bold text-emerald-400">خصم {amb.discountPercent}%</div>
                      <div className="text-[10px] text-white/50">
                        {amb.appliesTo === "SELECTED" ? "منتجات محددة (هوديز)" : "كل المنتجات"}
                      </div>
                    </td>

                    <td className="p-3.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          amb.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                        }`}
                      >
                        {amb.status === "ACTIVE" ? "نشط" : "موقوف"}
                      </span>
                    </td>

                    <td className="p-3.5">
                      <div className="font-bold text-amber-400 flex items-center gap-1">
                        <Award className="w-3.5 h-3.5" />
                        <span>{amb.levelName}</span>
                      </div>
                      <div className="text-[10px] text-white/40">رتبة {amb.levelRank}</div>
                    </td>

                    <td className="p-3.5 text-center">
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        {amb.netSales}
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      <span className="font-mono text-sky-400 text-sm">
                        {amb.pendingSales}
                      </span>
                    </td>

                    <td className="p-3.5 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          variant="secondary"
                          onClick={() => handleOpenDetail(amb.id)}
                          title="عرض التفاصيل والمعالم"
                        >
                          <Eye className="w-3.5 h-3.5 ml-1" />
                          <span>التفاصيل</span>
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => handleToggleStatus(amb)}
                          title={amb.status === "ACTIVE" ? "إيقاف السفير مؤقتاً" : "تفعيل السفير"}
                        >
                          {amb.status === "ACTIVE" ? "إيقاف" : "تفعيل"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Ambassador Modal */}
      {showCreateModal && (
        <Dialog
          open={showCreateModal}
          title="إضافة سفير شارع جديد (New Street Ambassador)"
          onClose={() => setShowCreateModal(false)}
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4 text-right" dir="rtl">
            <p className="text-xs text-white/60">
              سيتم إنشاء ملف السفير، وتوليد كود الخصم المشفر، وإنشاء حساب خاص به للدخول على بورتال السفراء فورياً.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1">الاسم بالكامل *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: أحمد محمد علي"
                  value={formFullName}
                  onChange={(e) => {
                    setFormFullName(e.target.value);
                    if (!formDisplayName) setFormDisplayName(e.target.value.split(" ")[0]);
                  }}
                  className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1">اسم الشهرة / العرض</label>
                <input
                  type="text"
                  placeholder="مثال: أحمد"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1">رقم الموبايل (واتساب) *</label>
                <input
                  type="text"
                  required
                  placeholder="01012345678"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-white"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1">البريد الإلكتروني *</label>
                <input
                  type="email"
                  required
                  placeholder="ambassador@terrahop.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1">حساب إنستغرام (اختياري)</label>
                <input
                  type="text"
                  placeholder="@handle"
                  value={formInstagram}
                  onChange={(e) => setFormInstagram(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-white"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1">المحافظة / المدينة</label>
                <input
                  type="text"
                  placeholder="القاهرة"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white"
                />
              </div>
            </div>

            <div className="border-t border-[#333] pt-3">
              <h4 className="text-xs font-bold text-amber-400 mb-2">إعدادات كود الخصم (مشفّر AES-256)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1">كود الخصم *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: AHMED10"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg px-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-white"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/80 mb-1">نسبة الخصم للعميل (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formDiscount}
                    onChange={(e) => setFormDiscount(e.target.value)}
                    className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-white"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-xs font-semibold text-white/80 mb-1">نطاق تطبيق الخصم</label>
                <div className="flex gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="appliesTo"
                      checked={formAppliesTo === "ALL_PRODUCTS"}
                      onChange={() => setFormAppliesTo("ALL_PRODUCTS")}
                    />
                    <span>يسري على جميع المنتجات</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="appliesTo"
                      checked={formAppliesTo === "SELECTED"}
                      onChange={() => setFormAppliesTo("SELECTED")}
                    />
                    <span>يسري على الهوديز فقط (الموصى به)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="border-t border-[#333] pt-3">
              <h4 className="text-xs font-bold text-sky-400 mb-2">بيانات دخول بورتال السفير</h4>
              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1">
                  كلمة المرور الابتدائية (اتركها فارغة لاستخدام رقم الهاتف)
                </label>
                <input
                  type="text"
                  placeholder="تلقائي: رقم الهاتف"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-white"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-[#333]">
              <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>
                إلغاء
              </Button>
              <Button variant="primary" type="submit" disabled={submitting}>
                {submitting ? "جاري الحفظ..." : "حفظ وإنشاء السفير"}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Detail & Milestones Modal */}
      {selectedAmbassadorId && (
        <Dialog
          open={Boolean(selectedAmbassadorId)}
          title="تفاصيل السفير ومسار المعالم (Ambassador Profile)"
          onClose={() => setSelectedAmbassadorId(null)}
        >
          {detailLoading || !detailData ? (
            <div className="p-8 text-center text-white/60">جاري تحميل بيانات السفير...</div>
          ) : (
            <div className="space-y-6 text-right max-h-[75vh] overflow-y-auto pl-2" dir="rtl">
              {/* Profile Overview Header */}
              <div className="bg-[#141414] border border-[#262626] p-4 rounded-xl flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-lg font-bold text-white">{detailData.ambassador.fullName}</h3>
                  <div className="text-xs text-white/50 font-mono mt-0.5">
                    {detailData.ambassador.phone} &bull; {detailData.ambassador.email}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded font-bold">
                    المستوى: {detailData.ambassador.levelName}
                  </span>
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded font-bold font-mono">
                    {detailData.ambassador.netSales} مبيعة مؤكدة
                  </span>
                </div>
              </div>

              {/* Codes */}
              <div>
                <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-emerald-400" />
                  <span>أكواد الخصم التابعة</span>
                </h4>
                <div className="space-y-2">
                  {detailData.codes.map((c: any) => (
                    <div
                      key={c.id}
                      className="p-3 bg-[#111] border border-[#292929] rounded-lg flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-sm bg-black px-2 py-0.5 rounded border border-[#333]">
                          {c.code}
                        </span>
                        <span className="text-emerald-400 font-semibold">خصم {c.discountPercent}%</span>
                        <span className="text-white/40">({c.appliesTo === "SELECTED" ? "هوديز محددة" : "كل المنتجات"})</span>
                      </div>
                      <span className="text-white/50 font-mono">استخدم {c.usedCount} مرة</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Milestones Timeline */}
              <div>
                <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  <span>خط المعالم والأحداث (Milestones Timeline)</span>
                </h4>
                {detailData.milestones.length === 0 ? (
                  <div className="text-xs text-white/40 p-3 bg-[#111] rounded-lg">لا توجد معالم مسجلة بعد.</div>
                ) : (
                  <div className="space-y-2 border-r-2 border-[#333] pr-3 mr-1">
                    {detailData.milestones.map((m: any) => (
                      <div key={m.id} className="relative text-xs">
                        <div className="font-semibold text-white">{m.description}</div>
                        <div className="text-[10px] text-white/40 font-mono mt-0.5">
                          {new Date(m.occurred_at).toLocaleString("ar-EG")} &bull; بواسطة: {m.created_by}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Rewards with decrypted vouchers */}
              <div>
                <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>المكافآت وكبونات الـ 80% الممنوحة</span>
                </h4>
                {detailData.rewards.length === 0 ? (
                  <div className="text-xs text-white/40 p-3 bg-[#111] rounded-lg">لم يحصل السفير على مكافآت بعد.</div>
                ) : (
                  <div className="space-y-2">
                    {detailData.rewards.map((r: any) => (
                      <div
                        key={r.id}
                        className="p-3 bg-[#111] border border-[#292929] rounded-lg flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-white">{r.title}</div>
                          <div className="text-white/50 text-[11px]">{r.description}</div>
                          {r.voucher?.code && (
                            <div className="mt-1 inline-flex items-center gap-2 bg-black px-2 py-0.5 rounded border border-[#333] text-emerald-400 font-mono">
                              <span>كود الخصم 80%: {r.voucher.code}</span>
                              <span className="text-[10px] text-white/40">({r.voucher.status})</span>
                            </div>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-white/40">
                          {new Date(r.earnedAt).toLocaleDateString("ar-EG")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Orders List */}
              <div>
                <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                  <span>الطلبات المنسوبة لهذا السفير</span>
                </h4>
                {detailData.orders.length === 0 ? (
                  <div className="text-xs text-white/40 p-3 bg-[#111] rounded-lg">لا توجد طلبات مسجلة حتى الآن.</div>
                ) : (
                  <div className="space-y-2">
                    {detailData.orders.map((o: any) => (
                      <div
                        key={o.id}
                        className="p-3 bg-[#111] border border-[#292929] rounded-lg flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-mono font-bold text-white">{o.number}</span>
                          <span className="text-white/50 mr-2">العميل: {o.customerName}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-white">{o.total} ج.م</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              o.fulfilmentStatus === "DELIVERED"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-sky-500/10 text-sky-400"
                            }`}
                          >
                            {o.fulfilmentStatus === "DELIVERED" ? "تم التسليم والتحصيل" : "قيد المعالجة"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}
