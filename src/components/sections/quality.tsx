"use client";

import Link from "next/link";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { Container, Grid } from "@/components/ui/container";
import { Divider } from "@/components/ui/divider";
import { useLocale } from "@/lib/locale-context";
import type { home } from "@/content/home";

export function Quality({ quality }: { quality: typeof home.quality }) {
  const { t } = useLocale();
  const specs = t.quality.specs && t.quality.specs.length > 0 ? t.quality.specs : quality.specs;
  const steps = t.quality.steps && t.quality.steps.length > 0 ? t.quality.steps : quality.steps;

  return (
    <section aria-labelledby="quality-heading" className="border-t border-line-light py-16 lg:py-24">
      <Container>
        <Grid className="gap-y-12">
          <Reveal className="col-span-4 md:col-span-8 lg:col-span-5">
            <h2 id="quality-heading" className="text-h1">
              {t.quality.heading}
            </h2>
            {specs.length > 0 && (
              <dl className="mt-8">
                {specs.map((s) => (
                  <div key={s.label} className="border-t border-line-light py-4 sm:flex sm:gap-6">
                    <dt className="text-label w-36 shrink-0 text-graphite">{s.label}</dt>
                    <dd className="mt-1 sm:mt-0 font-medium text-obsidian">{s.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Reveal>
          {steps.length > 0 && (
            <div className="col-span-4 md:col-span-8 lg:col-span-6 lg:col-start-7">
              <ol>
                {steps.map((step, i) => (
                  <RevealItem key={step.title} index={i}>
                    {i > 0 && <Divider />}
                    <div className="flex gap-6 py-6">
                      <span className="font-display text-h2 w-8 shrink-0 tabular-nums text-obsidian/70" aria-hidden="true">
                        {i + 1}
                      </span>
                      <div>
                        <h3 className="text-h3">{step.title}</h3>
                        <p className="mt-2 max-w-[55ch] text-graphite leading-relaxed">{step.text}</p>
                      </div>
                    </div>
                  </RevealItem>
                ))}
              </ol>
              <Link
                href="/shop"
                className="mt-4 inline-block min-h-11 py-3 font-semibold underline underline-offset-4"
              >
                {t.quality.link}
              </Link>
            </div>
          )}
        </Grid>
      </Container>
    </section>
  );
}
