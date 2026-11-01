import type { ReactNode } from "react";
import { Header } from "./header";
import { Footer } from "./footer";
import { Container } from "@/components/ui/container";
import { home } from "@/content/home";

// Shared frame for inner pages: solid header, one <main>, footer.
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Header header={home.header} />
      <main id="main" className="min-h-[60dvh]">
        <Container className="py-12 lg:py-20">{children}</Container>
      </main>
      <Footer footer={home.footer} />
    </>
  );
}
