"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Copy, LogOut, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button, EmptyState, StatCard, Table, ToastProvider, useToast, type Column } from "@/components/admin/ui";

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
  code: { code: string; discountPercent: number; appliesTo: string; usedCount: number };
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

type Sale = AmbassadorData["salesHistory"][number];

const TIERS = [
  { rank: 1, name: "Starter", at: 10, reward: "هدية من البراند" },
  { rank: 2, name: "Rising", at: 20, reward: "كود خصم 80%" },
  { rank: 3, name: "Elite", at: 30, reward: "VIP Drop Box" },
];

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" });
const fmtShort = (iso: string) => new Date(iso).toLocaleDateString("ar-EG");

/** Copy button with a text confirmation, so the state is never shown by colour or icon alone. */
function CopyButton({ text, label, variant = "primary" }: { text: string; label: string; variant?: "primary" | "secondary" | "light" }) {
  const toast = useToast();
  const [done, setDone] = useState(false);
  return (
    <Button
      variant={variant}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setDone(true);
        toast.push(`تم نسخ ${text}`);
        setTimeout(() => setDone(false), 2500);
      }}
    >
      {done ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      <span>{done ? "تم النسخ" : label}</span>
    </Button>
  );
}

function Portal() {
  const router = useRouter();
  const [data, setData] = useState<AmbassadorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ambassador/me", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        router.replace("/ambassador/login");
        return;
      }
      const json = await res.json();
      if (json.ok && json.data) {
        setData(json.data);
        setError(null);
      } else setError(json.message || "فشل تحميل بيانات السفير.");
    } catch {
      setError("خطأ في الاتصال بالخادم.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const logout = async () => {
    await fetch("/api/ambassador/auth/logout", { method: "POST" });
    router.replace("/ambassador/login");
  };

  if (loading) {
    return (
      <div className="adm-stack" role="status">
        <p className="adm-label adm-muted">جاري تحميل بورتال السفير…</p>
        <div className="adm-stats">
          {[0, 1, 2, 3].map((i) => <div key={i} className="adm-skeleton" />)}
        </div>
        <div className="adm-skeleton" style={{ height: 180 }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        title="حدث خطأ"
        description={error || "تعذر الوصول لحساب السفير."}
        action={<Button onClick={() => { setLoading(true); load(); }}>إعادة المحاولة</Button>}
      />
    );
  }

  const { profile, code, stats, rewards, salesHistory } = data;
  const nextTier = TIERS.find((t) => stats.netSales < t.at);

  const columns: Column<Sale>[] = [
    { key: "num", header: "رقم الطلب", cell: (s) => <span className="adm-num" dir="ltr" style={{ fontWeight: 600 }}>{s.maskedNumber}</span> },
    { key: "date", header: "التاريخ", cell: (s) => <span className="adm-num">{fmtDate(s.createdAt)}</span> },
    {
      key: "state",
      header: "الحالة",
      cell: (s) => (
        <span className={`adm-badge ${s.isDelivered ? "adm-badge-sold" : "adm-badge-amb"}`}>{s.stateLabel}</span>
      ),
    },
    { key: "units", header: "المحتسب لك", align: "end", cell: (s) => <span className="adm-num">{s.isDelivered ? `+${s.units}` : "—"}</span> },
  ];

  return (
    <>
      <PageHeader
        title="بورتال السفير"
        description="مبيعاتك المؤكدة، مستواك، ومكافآتك في مكان واحد. الطلب يُحتسب لك بعد التسليم والتحصيل فقط."
        actions={
          <Button variant="secondary" onClick={() => { setRefreshing(true); load(); }} aria-label="تحديث البيانات">
            <RefreshCw className={refreshing ? "adm-spin" : undefined} aria-hidden="true" />
            <span>تحديث</span>
          </Button>
        }
      />

      {/* Hero: the code is the one thing an ambassador comes here for */}
      <section className="amb-hero adm-on-dark" aria-labelledby="amb-hello">
        <div>
          <span className="adm-badge">{profile.status === "ACTIVE" ? "حساب سفير نشط" : "الحساب موقوف"}</span>
          <h2 id="amb-hello" className="amb-hello" style={{ marginTop: 16 }}>أهلاً يا {profile.displayName}</h2>
          <p>
            شارك كودك مع متابعيك وأصحابك. عميلك ياخد خصم {code.discountPercent}%، ومع كل تسليم ناجح بتقرب من المستوى
            اللي بعده وبتفتح هدايا وأكواد خصم 80%.
          </p>
        </div>
        <div className="amb-code-box">
          <span className="adm-label">كود الخصم الخاص بك</span>
          <span className="amb-code-value">{code.code}</span>
          <span className="adm-small" style={{ color: "var(--adm-concrete)" }}>
            خصم {code.discountPercent}% للعميل · استُخدم {code.usedCount} مرة
          </span>
          <CopyButton text={code.code} label="انسخ الكود" variant="light" />
        </div>
      </section>

      <section className="adm-section" aria-label="ملخص الأداء">
        <div className="adm-stats">
          <StatCard label="المبيعات المؤكدة" value={String(stats.netSales)} hint="تم تسليمها وتحصيلها" />
          <StatCard label="قيد التوصيل" value={String(stats.pendingSales)} hint="بانتظار استلام العميل" />
          <StatCard label="المستوى الحالي" value={stats.currentLevelName} hint={`رتبة ${stats.currentLevelRank} من ${TIERS.length}`} />
          <StatCard label="المكافآت" value={String(rewards.length)} hint="هدايا وأكواد خصم 80%" />
        </div>
      </section>

      <section className="adm-section amb-section adm-card" aria-labelledby="amb-progress">
        <div className="amb-progress-meta">
          <div>
            <h2 id="amb-progress" className="adm-h2">مسارك للمستوى القادم</h2>
            <p className="adm-muted adm-nomargin" style={{ marginTop: 4 }}>
              {stats.nextLevelName
                ? `باقي ${stats.salesNeededForNext} مبيعات مؤكدة للوصول إلى ${stats.nextLevelName}`
                : "وصلت لأعلى رتبة سفير. أداء استثنائي."}
            </p>
          </div>
          <span className="adm-num" style={{ fontWeight: 700 }}>
            {stats.netSales} / {stats.nextThreshold} · {stats.progressPercent}%
          </span>
        </div>
        <div
          className="amb-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={stats.progressPercent}
          aria-label="نسبة التقدم للمستوى القادم"
        >
          <span style={{ width: `${Math.max(2, Math.min(100, stats.progressPercent))}%` }} />
        </div>
        <ol className="amb-tiers">
          {TIERS.map((t) => {
            const done = stats.netSales >= t.at;
            const next = t === nextTier;
            return (
              <li key={t.rank} className={`amb-tier${done ? " is-done" : next ? " is-next" : ""}`}>
                <span className="adm-label">مستوى {t.rank}</span>
                <strong>{t.name}</strong>
                <span className="adm-small">{t.at} مبيعة · {t.reward}</span>
                <span className="adm-small" style={{ fontWeight: 700 }}>
                  {done ? "✓ مفتوح" : next ? "المستوى القادم" : "مقفول"}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="adm-section amb-section" aria-labelledby="amb-rewards">
        <div className="adm-section-head">
          <div>
            <h2 id="amb-rewards" className="adm-h2">مكافآتك وأكواد الخصم</h2>
            <p>الأكواد خاصة بحسابك ومشفّرة. ما تشاركهاش.</p>
          </div>
        </div>
        {rewards.length === 0 ? (
          <EmptyState
            title="لسه ما فتحتش مكافآت"
            description="أول ما توصل 10 مبيعات مؤكدة، هديتك الأولى هتظهر هنا تلقائياً."
          />
        ) : (
          <ul className="amb-rewards">
            {rewards.map((r) => {
              const used = r.voucher?.status === "REDEEMED";
              return (
                <li key={r.id}>
                  <article className={`adm-card amb-reward${used ? " is-used" : ""}`}>
                    <div className="adm-row" style={{ justifyContent: "space-between" }}>
                      <span className="adm-badge adm-badge-low">{r.levelName}</span>
                      {used ? (
                        <span className="adm-badge adm-badge-off"><s>مستخدم</s></span>
                      ) : (
                        <span className="adm-badge adm-badge-available">متاح</span>
                      )}
                    </div>
                    <div>
                      <h3 className="adm-h3">{r.title}</h3>
                      <p>{r.description}</p>
                    </div>
                    {r.voucher?.code ? (
                      <div className="amb-voucher">
                        <div className="adm-stack-sm">
                          <span className="adm-label adm-muted">كود خصم {r.voucher.discountPercent}%</span>
                          <span className="amb-voucher-code">{r.voucher.code}</span>
                        </div>
                        {!used ? <CopyButton text={r.voucher.code} label="نسخ" variant="secondary" /> : null}
                      </div>
                    ) : null}
                    <div className="amb-reward-foot">
                      <span className="adm-num">مُنحت: {fmtShort(r.earnedAt)}</span>
                      {r.expiresAt && !used ? <span className="adm-num">تنتهي: {fmtShort(r.expiresAt)}</span> : null}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="adm-section amb-section" aria-labelledby="amb-sales">
        <div className="adm-section-head">
          <div>
            <h2 id="amb-sales" className="adm-h2">سجل الطلبات المرتبطة بكودك</h2>
            <p>أرقام الطلبات مخفية جزئياً لحماية خصوصية المشترين.</p>
          </div>
          <span className="adm-badge adm-badge-pending adm-num">{salesHistory.length} طلب</span>
        </div>
        <Table
          caption="سجل الطلبات"
          columns={columns}
          rows={salesHistory}
          getKey={(s) => s.id}
          renderCard={(s) => (
            <div className="adm-stack-sm">
              <div className="adm-row" style={{ justifyContent: "space-between", width: "100%" }}>
                <span className="adm-num" dir="ltr" style={{ fontWeight: 600 }}>{s.maskedNumber}</span>
                <span className={`adm-badge ${s.isDelivered ? "adm-badge-sold" : "adm-badge-amb"}`}>{s.stateLabel}</span>
              </div>
              <span className="adm-muted adm-small adm-num">
                {fmtDate(s.createdAt)}{s.isDelivered ? ` · +${s.units} مبيعة` : ""}
              </span>
            </div>
          )}
          empty={
            <EmptyState
              title="مفيش طلبات لسه"
              description={`أول ما عميل يستخدم كود ${code.code} هيظهر طلبه هنا فوراً.`}
              action={<CopyButton text={code.code} label="انسخ الكود وشاركه" />}
            />
          }
        />
      </section>

      <SidebarProfile profile={profile} onLogout={logout} />
    </>
  );
}

/** Account card at the end of the page (also the target of the "حسابي" sidebar link). */
function SidebarProfile({ profile, onLogout }: { profile: AmbassadorData["profile"]; onLogout: () => void }) {
  return (
    <section className="adm-card adm-stack" aria-labelledby="amb-profile" style={{ maxWidth: 560 }}>
      <h2 id="amb-profile" className="adm-h2">بيانات حسابك</h2>
      <dl className="adm-dl">
        <dt>الاسم</dt><dd>{profile.fullName}</dd>
        <dt>الموبايل</dt><dd className="adm-num" dir="ltr" style={{ textAlign: "right" }}>{profile.phone}</dd>
        <dt>البريد</dt><dd dir="ltr" style={{ textAlign: "right" }}>{profile.email}</dd>
        {profile.instagramHandle ? (<><dt>إنستغرام</dt><dd dir="ltr" style={{ textAlign: "right" }}>{profile.instagramHandle}</dd></>) : null}
        <dt>تاريخ الانضمام</dt><dd className="adm-num">{fmtDate(profile.joinedAt)}</dd>
      </dl>
      <p className="adm-muted adm-small adm-nomargin">لتعديل بياناتك أو تغيير كلمة المرور تواصل مع إدارة المتجر على واتساب.</p>
      <div><Button variant="secondary" onClick={onLogout}><LogOut aria-hidden="true" /><span>تسجيل الخروج</span></Button></div>
    </section>
  );
}

export default function AmbassadorDashboardPage() {
  const router = useRouter();
  const logout = async () => {
    await fetch("/api/ambassador/auth/logout", { method: "POST" });
    router.replace("/ambassador/login");
  };
  const NAV = [
    { href: "#amb-hello", label: "كودي" },
    { href: "#amb-progress", label: "المستويات" },
    { href: "#amb-rewards", label: "المكافآت" },
    { href: "#amb-sales", label: "الطلبات" },
    { href: "#amb-profile", label: "حسابي" },
  ];

  return (
    <ToastProvider>
      <div className="adm" dir="rtl">
        <a className="adm-skip" href="#adm-main">تخطى إلى المحتوى</a>
        <div className="adm-shell">
          <aside className="adm-sidebar">
            <Link href="/" className="adm-brand">TERRA HOP</Link>
            <p className="adm-label" style={{ color: "var(--adm-concrete)", padding: "0 12px 16px", margin: 0 }}>سفراء الشارع</p>
            <nav aria-label="أقسام البورتال">
              <ul className="adm-nav">
                {NAV.map((n, i) => (
                  <li key={n.href}>
                    <a href={n.href} className="adm-nav-link" aria-current={i === 0 ? "page" : undefined}>
                      <span>{n.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="adm-sidebar-foot">
              <Link href="/" className="adm-nav-link">زيارة المتجر</Link>
              <button type="button" className="adm-nav-link adm-nav-button" style={{ color: "#DC2626" }} onClick={logout}>
                تسجيل الخروج
              </button>
            </div>
          </aside>

          <div>
            <header className="adm-topbar">
              <Link href="/" className="adm-brand">TERRA HOP</Link>
              <Button variant="light" onClick={logout}>
                <LogOut aria-hidden="true" />
                <span>خروج</span>
              </Button>
            </header>
            <main id="adm-main" tabIndex={-1} className="adm-main">
              <Portal />
            </main>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
