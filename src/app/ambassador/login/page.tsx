import type { Metadata } from "next";
import Link from "next/link";
import { HoodieShowcase } from "@/components/admin/hoodie-showcase";
import { AmbassadorLoginForm } from "@/components/ambassador/AmbassadorLoginForm";
import { Logo } from "@/components/ui/logo";
import { uiStrings } from "@/lib/ui-strings";

export const metadata: Metadata = {
  title: "دخول السفراء",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

// Same split layout as the admin login: dark showcase panel + light form panel.
export default function AmbassadorLoginPage() {
  return (
    <main id="main" dir="rtl" className="grid min-h-dvh lg:grid-cols-2">
      <div className="on-dark relative isolate flex min-h-[460px] flex-col gap-4 overflow-hidden bg-obsidian p-4 text-off-white md:min-h-[560px] md:p-6 lg:min-h-dvh lg:p-10">
        <Link href="/" aria-label={uiStrings.logoAlt} className="block w-28 md:w-36 lg:w-44">
          <Logo />
        </Link>
        <HoodieShowcase />
      </div>

      <div className="flex flex-col justify-center px-4 py-12 md:px-6 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <p className="text-label text-graphite">سفراء الشارع · Street Ambassadors</p>
          <h1 className="text-h1 mt-3">دخول السفير</h1>
          <p className="mt-3 text-graphite">تابع مبيعاتك المؤكدة، مستواك، وأكواد مكافآت الـ 80%.</p>
          <AmbassadorLoginForm />
          <p className="mt-8 border-t border-line-light pt-6 text-sm text-graphite">
            محتاج كود سفير أو نسيت كلمة المرور؟ تواصل مع إدارة المتجر على واتساب.
          </p>
          <Link href="/" className="mt-6 inline-block text-sm font-semibold underline underline-offset-4">
            العودة إلى المتجر
          </Link>
        </div>
      </div>
    </main>
  );
}
