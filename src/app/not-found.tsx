import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Logo } from "@/components/ui/logo";
import { home } from "@/content/home";
import { uiStrings } from "@/lib/ui-strings";

export default function NotFound() {
  return (
    <>
      <Header header={home.header} />
      <main id="main" className="mx-auto flex min-h-[60dvh] w-full max-w-[1280px] flex-col items-start justify-center px-4 py-16 md:px-6 lg:px-10">
        <Logo className="w-40" />
        <h1 className="text-h1 mt-8">{uiStrings.notFound.title}</h1>
        <p className="mt-2 text-(--fg-muted)">{uiStrings.notFound.message}</p>
        <Link href={home.header.homeHref} className="mt-6 font-semibold underline underline-offset-4">
          {uiStrings.notFound.back}
        </Link>
      </main>
      <Footer footer={home.footer} />
    </>
  );
}
