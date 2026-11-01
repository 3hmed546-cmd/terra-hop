"use client";

import Image from "next/image";
import { PageShell } from "@/components/layout/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { Grid } from "@/components/ui/container";
import { ImageReveal, Reveal } from "@/components/motion/reveal";
import { images } from "@/content/images";
import { useLocale } from "@/lib/locale-context";

export function AboutView() {
  const { t } = useLocale();
  const image = images.story;

  return (
    <PageShell>
      <Grid className="items-start gap-y-10">
        <Reveal className="col-span-4 md:col-span-8 lg:col-span-5 lg:pr-8">
          <h1 className="text-h1">{t.about.heading}</h1>
          <p className="text-h3 mt-6">{t.about.intro}</p>
          {t.about.body.map((p, idx) => (
            <p key={idx} className="mt-4 max-w-[60ch] text-graphite leading-relaxed">
              {p}
            </p>
          ))}
          <ButtonLink href="/shop" className="mt-8">
            {t.about.cta}
          </ButtonLink>
        </Reveal>
        <ImageReveal className="col-span-4 md:col-span-8 lg:col-span-7">
          <Image
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            sizes="(min-width: 1024px) 58vw, 100vw"
            className="h-auto w-full object-cover"
            priority
          />
        </ImageReveal>
      </Grid>
      <Reveal className="mt-16 border-t border-line-light pt-10 lg:mt-24">
        <h2 className="text-h2">{t.about.valuesHeading}</h2>
        <dl className="mt-6 max-w-2xl">
          {t.about.values.map((v) => (
            <div key={v.label} className="border-t border-line-light py-4 sm:flex sm:gap-6">
              <dt className="text-label w-32 shrink-0 text-graphite">{v.label}</dt>
              <dd className="mt-1 sm:mt-0 font-medium">{v.value}</dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </PageShell>
  );
}
