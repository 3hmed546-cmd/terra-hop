import type { Metadata } from "next";
import Link from "next/link";
import { HoodieShowcase } from "@/components/admin/hoodie-showcase";
import { LoginForm } from "@/components/admin/login-form";
import { uiStrings } from "@/lib/ui-strings";

const t = uiStrings.adminLogin;

export const metadata: Metadata = {
  title: t.documentTitle,
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

// Reached only through the hidden path (see src/proxy.ts). No header, no footer, no links into this page.
export default function AdminLoginPage() {
  return (
    <main id="main" className="grid min-h-dvh lg:grid-cols-2 bg-[#fcfaf7]">
      {/* Left visual panel */}
      <div className="on-dark relative isolate flex flex-col justify-between overflow-hidden bg-obsidian text-off-white h-[380px] sm:h-[460px] lg:h-auto lg:min-h-dvh">
        <HoodieShowcase />
      </div>

      {/* Right login form panel */}
      <div className="flex flex-col justify-center px-5 py-8 sm:py-12 md:px-8 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <p className="text-label text-graphite">{t.label}</p>
          <h1 className="text-h1 mt-2 text-2xl font-bold sm:text-3xl">{t.heading}</h1>
          <p className="mt-2 text-sm text-graphite sm:text-base">{t.text}</p>
          <LoginForm />
          <Link href="/" className="mt-8 inline-block text-sm font-semibold underline underline-offset-4 text-graphite hover:text-black transition-colors">
            {t.backToStore}
          </Link>
        </div>
      </div>
    </main>
  );
}
