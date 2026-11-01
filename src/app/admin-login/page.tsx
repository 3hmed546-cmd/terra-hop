import type { Metadata } from "next";
import Link from "next/link";
import { HoodieShowcase } from "@/components/admin/hoodie-showcase";
import { LoginForm } from "@/components/admin/login-form";
import { Logo } from "@/components/ui/logo";
import { uiStrings } from "@/lib/ui-strings";

const t = uiStrings.adminLogin;

export const metadata: Metadata = {
  title: t.documentTitle,
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

// Reached only through the hidden path (see src/proxy.ts). No header, no footer, no links into this page.
export default function AdminLoginPage() {
  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-2">
      <div className="on-dark relative isolate flex min-h-[460px] flex-col gap-4 overflow-hidden bg-obsidian p-4 text-off-white md:min-h-[560px] md:p-6 lg:min-h-dvh lg:p-10">
        <Link href="/" aria-label={uiStrings.logoAlt} className="block w-28 md:w-36 lg:w-44">
          <Logo />
        </Link>
        <HoodieShowcase />
      </div>

      <div className="flex flex-col justify-center px-4 py-12 md:px-6 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <p className="text-label text-graphite">{t.label}</p>
          <h1 className="text-h1 mt-3">{t.heading}</h1>
          <p className="mt-3 text-graphite">{t.text}</p>
          <LoginForm />
          <Link href="/" className="mt-10 inline-block text-sm font-semibold underline underline-offset-4">
            {t.backToStore}
          </Link>
        </div>
      </div>
    </main>
  );
}
