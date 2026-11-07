import type { Metadata } from "next";
import { Hero } from "@/components/sections/hero";
import { OffersTicker } from "@/components/sections/offers-ticker";
import { Drop } from "@/components/sections/drop";
import { BrandStory } from "@/components/sections/brand-story";
import { Quality } from "@/components/sections/quality";
import { Signup } from "@/components/sections/signup";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { home } from "@/content/home";

export const metadata: Metadata = { title: { absolute: home.meta.title }, description: home.meta.description };

// Homepage: Header, Hero, The Drop, Brand Story, Details, Signup, Footer, all from home.ts.
// The header sits outside <main> (banner landmark) and is laid over the hero.
export default function Page() {
  return (
    <>
      <div className="relative">
        <Header header={home.header} overlay />
        <main id="main">
          <Hero hero={home.hero} />
          <OffersTicker ticker={home.ticker} />
          <Drop drop={home.drop} />
          <BrandStory story={home.brandStory} />
          <Quality quality={home.quality} />
          <Signup signup={home.signup} />
        </main>
      </div>
      <Footer footer={home.footer} />
    </>
  );
}
