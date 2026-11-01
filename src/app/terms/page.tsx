import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = {
  title: "الشروط والأحكام | Terms of Service",
};

export default function TermsPage() {
  return (
    <PageShell>
      <div className="max-w-3xl mx-auto space-y-6 text-sm text-graphite py-6">
        <h1 className="text-3xl font-extrabold text-obsidian">الشروط والأحكام | Terms & Conditions</h1>
        <p>
          مرحباً بكم في TERRA HOP. تنطبق هذه الشروط على جميع عمليات الشراء والطلبات المنفذة عبر متجرنا.
        </p>
        <div className="space-y-4 border-t border-line-light pt-4 text-obsidian">
          <h2 className="text-lg font-bold">1. تأكيد الطلبات والشحن</h2>
          <p className="text-graphite">
            يتم مراجعة كافة الطلبات وتأكيدها هاتفياً أو عبر الواتساب قبل إرسال الشحنة لضمان وصول المقاس الصحيح.
          </p>
          <h2 className="text-lg font-bold">2. الدفع والمعاينة</h2>
          <p className="text-graphite">
            نوفر ميزة الدفع عند الاستلام مع إمكانية فتح الشحنة ومعاينة القطع والتأكد من الجودة والمقاس قبل السداد للمندوب.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
