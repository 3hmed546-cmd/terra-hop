"use client";

import { PageShell } from "@/components/layout/page-shell";
import { Reveal } from "@/components/motion/reveal";
import { home } from "@/content/home";
import { useLocale } from "@/lib/locale-context";

const link = "font-semibold underline underline-offset-4";

export function HelpView() {
  const { t } = useLocale();
  const { footer } = home;

  return (
    <PageShell>
      <Reveal>
        <h1 className="text-h1">{t.help.heading}</h1>
        <p className="mt-4 max-w-[55ch] text-graphite leading-relaxed">{t.help.text}</p>
      </Reveal>

      <Reveal className="mt-12 max-w-3xl">
        <h2 className="text-h2">{t.help.faqHeading}</h2>
        <div className="mt-6 border-b border-line-light">
          {t.help.faq.map((item, idx) => (
            <details key={idx} className="group border-t border-line-light">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                <span>{item.q}</span>
                <span
                  aria-hidden="true"
                  className="text-2xl leading-none transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="max-w-[60ch] pb-5 text-graphite leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </Reveal>

      <Reveal className="mt-16 max-w-3xl scroll-mt-8">
        <section id="shipping" aria-labelledby="shipping-heading" className="scroll-mt-8">
          <h2 id="shipping-heading" className="text-h2">
            {t.help.shippingHeading}
          </h2>
          <dl className="mt-6">
            {t.help.shippingPoints.map((p, idx) => (
              <div key={idx} className="border-t border-line-light py-4 sm:flex sm:gap-6">
                <dt className="text-label w-36 shrink-0 text-graphite">{p.title}</dt>
                <dd className="mt-1 max-w-[55ch] sm:mt-0 font-medium">{p.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      </Reveal>

      <Reveal className="mt-16 max-w-3xl">
        <h2 className="text-h2">{t.help.contactHeading}</h2>
        <p className="mt-4 text-graphite">{t.help.contactText}</p>
        <p className="mt-6 flex flex-wrap gap-x-8 gap-y-2">
          <a
            href={footer.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`${link} tabular-nums font-mono`}
          >
            WhatsApp: +20 128 569 4670
          </a>
          <a href="mailto:support@terra-hop.com" className={link}>
            support@terra-hop.com
          </a>
          <a href="mailto:info@terra-hop.com" className={link}>
            info@terra-hop.com
          </a>
        </p>
      </Reveal>
    </PageShell>
  );
}
