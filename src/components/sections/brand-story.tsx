"use client";

import Image from "next/image";
import { ImageReveal, Reveal } from "@/components/motion/reveal";
import { Container, Grid } from "@/components/ui/container";
import { images } from "@/content/images";
import { useLocale } from "@/lib/locale-context";
import type { home } from "@/content/home";

export function BrandStory({ story }: { story: typeof home.brandStory }) {
  const { t, locale } = useLocale();
  if (!story.heading && !story.body) return null;
  const image = images[story.image];

  return (
    <section aria-labelledby="story-heading" className="border-t border-line-light py-16 lg:py-24">
      <Container>
        <Grid className="items-center gap-y-8">
          <Reveal className="col-span-4 md:col-span-8 lg:col-span-5 lg:pr-8 text-start">
            <div dir={locale === "ar" ? "rtl" : "ltr"}>
              <h2 id="story-heading" className="text-h1">
                {t.brandStory.heading}
              </h2>
              <p className="mt-6 max-w-[65ch] text-graphite leading-relaxed">
                {t.brandStory.body}
              </p>
            </div>
          </Reveal>
          <ImageReveal className="col-span-4 md:col-span-8 lg:col-span-7">
            <Image
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="h-auto w-full"
            />
          </ImageReveal>
        </Grid>
      </Container>
    </section>
  );
}
