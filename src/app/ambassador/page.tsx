"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  LogOut,
  Copy,
  Check,
  TrendingUp,
  Award,
  Package,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronLeft,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface AmbassadorData {
  profile: {
    id: string;
    displayName: string;
    fullName: string;
    phone: string;
    email: string;
    instagramHandle: string | null;
    status: string;
    joinedAt: string;
    firstQualifiedAt: string | null;
  };
  code: {
    code: string;
    discountPercent: number;
    appliesTo: string;
    usedCount: number;
  };
  stats: {
    netSales: number;
    qualifiedSales: number;
    pendingSales: number;
    currentLevelName: string;
    currentLevelRank: number;
    nextLevelName: string | null;
    nextThreshold: number;
    salesNeededForNext: number;
    progressPercent: number;
  };
  rewards: Array<{
    id: string;
    levelName: string;
    levelRank: number;
    title: string;
    description: string;
    type: string;
    status: string;
    earnedAt: string;
    expiresAt: string | null;
    voucher: {
      id: string;
      code?: string;
      status: string;
      discountPercent: number;
      expiresAt: string;
      redeemedAt?: string;
    } | null;
  }>;
  salesHistory: Array<{
    id: string;
    maskedNumber: string;
    stateLabel: string;
    isDelivered: boolean;
    createdAt: string;
    deliveredAt: string | null;
    units: number;
  }>;
}

export default function AmbassadorDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<AmbassadorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAmbassadorData = useCallback(async () => {
    try {
      const res = await fetch("/api/ambassador/me", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        router.replace("/ambassador/login");
        return;
      }
      const json = await res.json();
      if (json.ok && json.data) {
        setData(json.data);
      } else {
        setError(json.message || "فشل تحميل بيانات السفير.");
      }
    } catch {
      setError("خطأ في الاتصال بالخادم.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    fetchAmbassadorData();
  }, [fetchAmbassadorData]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(label);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleLogout = async () => {
    await fetch("/api/ambassador/auth/logout", { method: "POST" });
    router.replace("/ambassador/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center text-white" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-white/50" />
          <p className="text-sm font-semibold tracking-wider text-white/70">جاري تحميل بورتال السفير...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] text-white flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full bg-[#171717] border border-[#2E2E2E] p-6 rounded-2xl text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold">حدث خطأ</h2>
          <p className="text-sm text-white/70">{error || "تعذر الوصول لحساب السفير."}</p>
          <button
            onClick={() => {
              setLoading(true);
              fetchAmbassadorData();
            }}
            className="w-full py-2.5 bg-white text-black font-bold rounded-lg text-sm"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  const { profile, code, stats, rewards, salesHistory } = data;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5] font-sans pb-16 selection:bg-white selection:text-black" dir="rtl">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-[#0D0D0D]/90 backdrop-blur-md border-b border-[#222]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-black uppercase tracking-wider text-white hover:opacity-80">
              TERRA HOP
            </Link>
            <span className="hidden sm:inline-block text-xs bg-white/10 text-white/80 px-2.5 py-0.5 rounded-full border border-white/15">
              سفراء الشارع
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setRefreshing(true);
                fetchAmbassadorData();
              }}
              title="تحديث البيانات"
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <span className="hidden md:inline-block text-xs text-white/60">
              مرحباً، <strong className="text-white">{profile.displayName}</strong>
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/30 border border-red-500/30 text-red-300 text-xs font-semibold hover:bg-red-950/60 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        {/* Welcome & Ambassador Code Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#181818] via-[#141414] to-[#0E0E0E] border border-[#262626] p-6 sm:p-8 shadow-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20 mb-3">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>حساب سفير نشط ومفعل</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">
                أهلاً بك يا {profile.displayName} 🔥
              </h1>
              <p className="mt-1 text-sm text-white/60 max-w-xl">
                شارك كود الخصم الخاص بك مع متابعيك وأصدقائك. يحصل عميلك على خصم {code.discountPercent}%، ومع كل تسليم ناجح تتقدم في المستويات وتفتح هدايا وأكواد خصم 80%!
              </p>
            </div>

            {/* The Referral Code Box */}
            <div className="bg-[#0A0A0A] border border-[#333] rounded-xl p-4 sm:p-5 flex flex-col items-center justify-center min-w-[260px]">
              <span className="text-[11px] font-semibold text-white/50 uppercase tracking-widest mb-1">
                كود الخصم الخاص بك
              </span>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-widest font-mono select-all">
                {code.code || "AHMED10"}
              </div>
              <div className="mt-1 text-xs text-emerald-400 font-medium">
                خصم {code.discountPercent}% للعملاء
              </div>
              <button
                onClick={() => handleCopy(code.code, "ref")}
                className="mt-3 w-full py-2 px-4 rounded-lg bg-white text-black font-bold text-xs flex items-center justify-center gap-2 hover:bg-neutral-200 transition-colors"
              >
                {copiedCode === "ref" ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>تم نسخ الكود!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>انسخ كود الخصم</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#141414] border border-[#242424] rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between text-white/60 mb-2">
              <span className="text-xs font-semibold">المبيعات المؤكدة</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">{stats.netSales}</div>
            <p className="mt-1 text-[11px] text-white/40">طلبات تم تسليمها وتحصيلها</p>
          </div>

          <div className="bg-[#141414] border border-[#242424] rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between text-white/60 mb-2">
              <span className="text-xs font-semibold">المستوى الحالي</span>
              <Award className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">{stats.currentLevelName}</div>
            <p className="mt-1 text-[11px] text-white/40">رتبة المستوى {stats.currentLevelRank}</p>
          </div>

          <div className="bg-[#141414] border border-[#242424] rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between text-white/60 mb-2">
              <span className="text-xs font-semibold">قيد التوصيل</span>
              <Package className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">{stats.pendingSales}</div>
            <p className="mt-1 text-[11px] text-white/40">طلبات مع الشحن بانتظار الاستلام</p>
          </div>

          <div className="bg-[#141414] border border-[#242424] rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between text-white/60 mb-2">
              <span className="text-xs font-semibold">المكافآت المكتسبة</span>
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">{rewards.length}</div>
            <p className="mt-1 text-[11px] text-white/40">هدايا وأكواد خصم 80%</p>
          </div>
        </div>

        {/* Level Progression Progress Bar */}
        <div className="bg-[#141414] border border-[#242424] rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>مسار تقدمك إلى المستوى القادم</span>
                {stats.nextLevelName && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    {stats.nextLevelName}
                  </span>
                )}
              </h2>
              <p className="text-xs text-white/60 mt-0.5">
                {stats.nextLevelName
                  ? `متبقي لك ${stats.salesNeededForNext} مبيعات مؤكدة للوصول إلى ${stats.nextLevelName} (${stats.nextThreshold} مبيعة)`
                  : "لقد وصلت إلى أعلى رتبة سفير حالياً! أداء استثنائي! 🏆"}
              </p>
            </div>
            <div className="text-sm font-bold text-white font-mono">
              {stats.netSales} / {stats.nextThreshold} مبيعة ({stats.progressPercent}%)
            </div>
          </div>

          {/* Bar */}
          <div className="w-full h-3 bg-[#242424] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-700 rounded-full"
              style={{ width: `${Math.max(5, stats.progressPercent)}%` }}
            />
          </div>

          {/* Milestones badges */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[#222] text-center text-xs">
            <div className={`p-2 rounded-lg ${stats.netSales >= 10 ? "bg-white/10 text-white font-bold" : "text-white/40"}`}>
              <span>مستوى 1 (Starter)</span>
              <div className="text-[10px] mt-0.5">10 مبيعات &bull; هدية براند</div>
            </div>
            <div className={`p-2 rounded-lg ${stats.netSales >= 20 ? "bg-white/10 text-white font-bold" : "text-white/40"}`}>
              <span>مستوى 2 (Rising)</span>
              <div className="text-[10px] mt-0.5">20 مبيعة &bull; كود خصم 80%</div>
            </div>
            <div className={`p-2 rounded-lg ${stats.netSales >= 30 ? "bg-white/10 text-white font-bold" : "text-white/40"}`}>
              <span>مستوى 3 (Elite)</span>
              <div className="text-[10px] mt-0.5">30 مبيعة &bull; VIP Drop Box</div>
            </div>
          </div>
        </div>

        {/* Rewards & Vouchers Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <span>مكافآتك وكبونات الخصم الحصرية</span>
            </h2>
            <span className="text-xs text-white/50">المكافآت مشفرة وخاصة بحسابك</span>
          </div>

          {rewards.length === 0 ? (
            <div className="bg-[#141414] border border-[#242424] rounded-2xl p-8 text-center text-white/50 text-sm">
              <Award className="w-10 h-10 text-white/20 mx-auto mb-2" />
              <p>لم تفتح أي مكافآت بعد.</p>
              <p className="text-xs text-white/40 mt-1">
                عند وصولك إلى 10 مبيعات مؤكدة، سيتم فتح هديتك الأولى تلقائياً هنا!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rewards.map((rwd) => {
                const isVoucher = Boolean(rwd.voucher?.code);
                const isRedeemed = rwd.voucher?.status === "REDEEMED";

                return (
                  <div
                    key={rwd.id}
                    className="bg-[#141414] border border-[#262626] rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
                          {rwd.levelName}
                        </span>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                            isRedeemed
                              ? "bg-neutral-800 text-neutral-400"
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          {isRedeemed ? "تم الاستخدام" : "متاح للاستخدام"}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-white">{rwd.title}</h3>
                      <p className="text-xs text-white/60 mt-1">{rwd.description}</p>

                      {isVoucher && rwd.voucher?.code && (
                        <div className="mt-4 p-3 bg-[#0D0D0D] border border-[#333] rounded-xl">
                          <span className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">
                            كود الخصم (80% على الهودي):
                          </span>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-lg font-mono font-black text-emerald-400 tracking-wider">
                              {rwd.voucher.code}
                            </span>
                            {!isRedeemed && (
                              <button
                                onClick={() => handleCopy(rwd.voucher!.code!, `vch_${rwd.id}`)}
                                className="px-3 py-1 rounded bg-white text-black text-xs font-bold flex items-center gap-1.5 hover:bg-neutral-200"
                              >
                                {copiedCode === `vch_${rwd.id}` ? (
                                  <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>تم النسخ</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>نسخ</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#222] flex items-center justify-between text-[11px] text-white/40">
                      <span>تاريخ المنح: {new Date(rwd.earnedAt).toLocaleDateString("ar-EG")}</span>
                      {rwd.expiresAt && !isRedeemed && (
                        <span>ينتهي: {new Date(rwd.expiresAt).toLocaleDateString("ar-EG")}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Redacted Sales History (Zero Customer PII) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-sky-400" />
                <span>سجل المبيعات والطلبات المرتبطة بك</span>
              </h2>
              <p className="text-xs text-white/50 mt-0.5">
                تظهر الطلبات بشكل مشفر ومحمي تلقائياً لحفظ خصوصية المشترين.
              </p>
            </div>
            <span className="text-xs font-mono text-white/60">{salesHistory.length} طلب</span>
          </div>

          {salesHistory.length === 0 ? (
            <div className="bg-[#141414] border border-[#242424] rounded-2xl p-8 text-center text-white/50 text-sm">
              <Package className="w-10 h-10 text-white/20 mx-auto mb-2" />
              <p>لم يتم تسجيل أي طلب باستخدام كودك حتى الآن.</p>
              <p className="text-xs text-white/40 mt-1">
                عند استخدام أي عميل لكود ({code.code}) سيظهر طلبه هنا فورياً!
              </p>
            </div>
          ) : (
            <div className="bg-[#141414] border border-[#242424] rounded-2xl overflow-hidden divide-y divide-[#222]">
              {salesHistory.map((s) => (
                <div key={s.id} className="p-4 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        s.isDelivered ? "bg-emerald-400" : "bg-sky-400"
                      }`}
                    />
                    <div>
                      <span className="text-sm font-mono font-bold text-white tracking-wider">
                        {s.maskedNumber}
                      </span>
                      <div className="text-xs text-white/40">
                        {new Date(s.createdAt).toLocaleDateString("ar-EG", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        s.isDelivered
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-sky-500/10 text-sky-300 border border-sky-500/20"
                      }`}
                    >
                      {s.stateLabel}
                    </span>
                    <span className="text-xs font-bold text-white/70">
                      +{s.units} مبيعة
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
