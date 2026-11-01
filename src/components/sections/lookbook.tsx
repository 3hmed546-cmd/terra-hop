"use client";

import Image from "next/image";
import Link from "next/link";
import { Reveal, RevealItem } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { images } from "@/content/images";
import { useLocale } from "@/lib/locale-context";
import type { home } from "@/content/home";

const pattern = [
  "lg:col-span-4 aspect-[4/5]",
  "lg:col-span-5 aspect-[4/5] lg:aspect-[5/4]",
  "lg:col-span-3 aspect-[4/5]",
  "lg:col-span-5 aspect-[4/5] lg:aspect-[5/4]",
  "lg:col-span-4 lg:col-start-7 aspect-[4/5]",
];

export function Lookbook({ lookbook }: { lookbook: typeof home.lookbook }) {
  const { t } = useLocale();
  if (lookbook.items.length < 3) return null;

  return (
    <section aria-labelledby="lookbook-heading" className="border-t border-line-light py-16 lg:py-24">
      <Container>
        <Reveal>
          <h2 id="lookbook-heading" className="text-h1">
            {t.lookbook.heading}
          </h2>
        </Reveal>
        <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-12 lg:items-start">
          {lookbook.items.map((item, i) => {
            const img = images[item.image];
            const frame = pattern[i % pattern.length];
            const picture = (
              <Image
                src={img.src}
                alt={img.alt}
                width={img.width}
                height={img.height}
                sizes="(min-width: 1024px) 40vw, (min-width: 768px) 33vw, 50vw"
                className="h-full w-full object-cover"
              />
            );
            return (
              <RevealItem
                key={item.image}
                index={i}
                className={`col-span-1 ${frame
                  .split(" ")
                  .filter((c) => c.startsWith("lg:col"))
                  .join(" ")}`}
              >
                <div
                  className={`overflow-hidden bg-charcoal ${frame
                    .split(" ")
                    .filter((c) => !c.startsWith("lg:col"))
                    .join(" ")}`}
                >
                  {item.href ? (
                    <Link href={item.href} className="block h-full w-full">
                      {picture}
                    </Link>
                  ) : (
                    picture
                  )}
                </div>
              </RevealItem>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
