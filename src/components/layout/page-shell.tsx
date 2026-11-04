import type { ReactNode } from "react";
import { Header } from "./header";
import { Footer } from "./footer";
import { Container } from "@/components/ui/container";
import { home } from "@/content/home";

// Shared frame for inner pages: solid header, one <main>, footer.
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-full overflow-x-hidden flex flex-col min-h-dvh">
      <Header header={home.header} />
      <main id="main" className="flex-1 w-full max-w-full">
        <Container className="py-8 sm:py-12 lg:py-20 w-full max-w-[1280px]">{children}</Container>
      </main>
      <Footer footer={home.footer} />
    </div>
  );
}
