import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { CheckCircle2, AlertCircle, ShoppingBag, ShieldCheck } from "lucide-react";
import { getDb, recordChange, recordAudit } from "@/lib/server/db";
import { decryptCustomer } from "@/lib/server/vault";
import { verifyOrderConfirmationToken } from "@/lib/server/mailer";
import { notifyAdminsOrderConfirmedByCustomer } from "@/lib/server/push";

export const metadata: Metadata = {
  title: "تأكيد الطلب | TERRA HOP",
  robots: { index: false, follow: false },
};

interface ConfirmPageProps {
  searchParams: Promise<{
    id?: string;
    token?: string;
  }>;
}

async function ConfirmContent({ searchParams }: ConfirmPageProps) {
  const params = await searchParams;
  const orderId = params?.id;
  const token = params?.token;

  if (!orderId || !token) {
    return (
      <main dir="rtl" className="min-h-dvh bg-obsidian text-off-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-[#171717] border border-[#2b2b2b] rounded-2xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black mb-2">رابط غير صالح</h1>
          <p className="text-graphite text-sm mb-6">رابط التأكيد مفقود أو غير مكتمل. يرجى مراجعة الرابط المرسل في بريدك الإلكتروني.</p>
          <Link href="/" className="inline-flex items-center gap-2 bg-off-white text-obsidian px-6 py-3 rounded-xl font-bold text-sm">
            <ShoppingBag className="w-4 h-4" />
            <span>العودة إلى المتجر</span>
          </Link>
        </div>
      </main>
    );
  }

  const db = getDb();
  const order = db.prepare(`
    SELECT id, number, status, created_at, customer_enc, total_cents
    FROM orders
    WHERE id = ?
  `).get(orderId) as any;

  if (!order) {
    return (
      <main dir="rtl" className="min-h-dvh bg-obsidian text-off-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-[#171717] border border-[#2b2b2b] rounded-2xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black mb-2">الطلب غير موجود</h1>
          <p className="text-graphite text-sm mb-6">لم يتم العثور على هذا الطلب في قاعدة البيانات.</p>
          <Link href="/" className="inline-flex items-center gap-2 bg-off-white text-obsidian px-6 py-3 rounded-xl font-bold text-sm">
            <span>العودة إلى المتجر</span>
          </Link>
        </div>
      </main>
    );
  }

  const isValidToken = verifyOrderConfirmationToken(order.id, order.created_at, token);
  if (!isValidToken) {
    return (
      <main dir="rtl" className="min-h-dvh bg-obsidian text-off-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-[#171717] border border-[#2b2b2b] rounded-2xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black mb-2">رمز التأكيد غير صحيح</h1>
          <p className="text-graphite text-sm mb-6">رمز التحقق الأمني غير متطابق. تأكد من فتح الرابط الأصلي من رسالة البريد الإلكتروني.</p>
          <Link href="/" className="inline-flex items-center gap-2 bg-off-white text-obsidian px-6 py-3 rounded-xl font-bold text-sm">
            <span>العودة إلى المتجر</span>
          </Link>
        </div>
      </main>
    );
  }

  let customerName = "العميل";
  try {
    const cust = decryptCustomer(order.customer_enc);
    customerName = cust.name;
  } catch {}

  // Atomic conditional transition: only transition and notify if status is strictly 'PENDING_EMAIL'
  const now = new Date().toISOString();
  const updateRes = db.prepare(`
    UPDATE orders
    SET status = 'AWAITING_APPROVAL', email_confirmed_at = ?, revision = revision + 1
    WHERE id = ? AND status = 'PENDING_EMAIL'
  `).run(now, order.id);

  const isFirstConfirmation = updateRes.changes > 0;

  if (isFirstConfirmation) {
    recordChange("orders", "orders", order.id, Date.now());
    recordAudit({
      actor: "customer",
      action: "CONFIRM_ORDER_EMAIL",
      entity: "orders",
      entityId: order.id,
      after: { note: `تأكيد رغبة الشراء عبر البريد الإلكتروني للطلب ${order.number}` },
    });

    // Notify Admins via Web Push
    notifyAdminsOrderConfirmedByCustomer({
      orderId: order.id,
      orderNumber: order.number,
      customerName,
      totalCents: order.total_cents,
    }).catch(() => {});
  }

  const totalFormatted = Math.round((order.total_cents || 0) / 100);

  return (
    <main dir="rtl" className="min-h-dvh bg-obsidian text-off-white flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg">
        {/* Brand Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block hover:opacity-85 transition-opacity">
            <img
              src="/logo/terra-hop-logo-white.png"
              alt="TERRA HOP"
              className="h-10 mx-auto object-contain"
              width={140}
              height={54}
            />
          </Link>
        </div>

        {/* Card */}
        <div className="bg-[#161616] border border-[#262626] rounded-2xl p-6 sm:p-10 text-center shadow-2xl relative">
          {/* Success Check Icon */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center mx-auto mb-6">
            <img
              src="/order-success-check.png"
              alt="تم تأكيد طلبك بنجاح"
              className="w-full h-full object-contain animate-in zoom-in-90 duration-300 drop-shadow-md"
              width={96}
              height={96}
            />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black mb-4 text-white tracking-tight">
            {isFirstConfirmation ? "تم تأكيد طلبك بنجاح" : "طلبك مؤكد بالفعل"}
          </h1>

          {/* White Order Number Pill */}
          <div className="inline-flex items-center gap-2 bg-[#222222] border border-[#333333] px-5 py-2 rounded-full mb-6">
            <span className="text-xs text-[#888888]">رقم الطلب:</span>
            <span className="font-mono text-sm font-bold text-white tracking-wider">{order.number}</span>
          </div>

          <p className="text-[#a3a3a3] text-sm sm:text-base leading-relaxed mb-7 max-w-md mx-auto">
            شكراً لك يا <strong className="text-white font-semibold">{customerName}</strong>. تم تسجيل تأكيد رغبتك في شراء الطلب بنجاح.
            يقوم فريق عمل <strong className="text-white">TERRA HOP</strong> الآن بمراجعة طلبك وتجهيزه للشحن، وسيتواصل معك مندوب شركة التوصيل قريباً.
          </p>

          {/* Info Box */}
          <div className="bg-[#1c1c1c] border border-[#2b2b2b] rounded-xl p-5 mb-8 text-right text-xs sm:text-sm space-y-3">
            <div className="flex items-center justify-between text-[#888888] border-b border-[#2b2b2b] pb-2.5">
              <span className="flex items-center gap-2 text-white font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                طريقة الدفع
              </span>
              <span className="text-[#cccccc]">الدفع نقداً عند الاستلام والمعاينة</span>
            </div>
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-[#888888]">المبلغ المطلوب سداده عند الاستلام:</span>
              <strong className="text-white text-base sm:text-lg font-black font-mono">{totalFormatted} ج.م</strong>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/shop"
              className="flex-1 inline-flex items-center justify-center gap-2 bg-white text-black hover:bg-neutral-200 px-6 py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>متابعة التسوق في المتجر</span>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#666666] mt-6">
          TERRA HOP · Streetwear Redefined © 2026
        </p>
      </div>
    </main>
  );
}

function Fallback() {
  return (
    <main dir="rtl" className="min-h-dvh bg-obsidian text-off-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#171717] border border-[#2b2b2b] rounded-2xl p-8 text-center animate-pulse">
        <div className="w-16 h-16 bg-[#262626] rounded-full mx-auto mb-4" />
        <div className="h-6 bg-[#262626] rounded w-1/2 mx-auto mb-2" />
        <div className="h-4 bg-[#262626] rounded w-3/4 mx-auto" />
      </div>
    </main>
  );
}

export default function OrderConfirmPage({ searchParams }: ConfirmPageProps) {
  return (
    <Suspense fallback={<Fallback />}>
      <ConfirmContent searchParams={searchParams} />
    </Suspense>
  );
}
