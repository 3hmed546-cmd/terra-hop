import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = {
  title: "سياسة الخصوصية | Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <PageShell>
      <div className="max-w-3xl mx-auto space-y-6 text-sm text-graphite py-6">
        <h1 className="text-3xl font-extrabold text-obsidian">سياسة الخصوصية | Privacy Policy</h1>
        <p>
          نحن في TERRA HOP نحرص على حماية بياناتكم الشخصية ونلتزم بأعلى معايير الخصوصية والأمان عند معالجة طلباتكم.
        </p>
        <div className="space-y-4 border-t border-line-light pt-4 text-obsidian">
          <h2 className="text-lg font-bold">1. البيانات التي نجمعها</h2>
          <p className="text-graphite">
            نقوم بجمع الاسم، ورقم الهاتف، وعنوان الشحن، والبريد الإلكتروني فقط لغرض توصيل الشحنة ومتابعة حالة الأوردر.
          </p>
          <h2 className="text-lg font-bold">2. سرية المعلومات</h2>
          <p className="text-graphite">
            لا نقوم ببيع أو مشاركة بياناتكم مع أي أطراف خارجية، باستثناء شركة الشحن المسؤولة عن تسليم الأوردر إليكم.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
