"use client";

import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { WhatsAppIcon, InstagramIcon, TikTokIcon } from "@/components/ui/social-icons";
import { useLocale } from "@/lib/locale-context";
import { useLive } from "@/lib/use-live";
import type { home } from "@/content/home";

export function Signup({ signup }: { signup: typeof home.signup }) {
  const { locale } = useLocale();
  const { data: liveSite } = useLive("settings");

  // Real-time live settings fallback
  const liveContacts = liveSite?.settings?.store?.footer_contacts;
  const whatsappGroupUrl =
    liveContacts?.whatsappGroupUrl ||
    signup.whatsappGroupUrl ||
    "https://chat.whatsapp.com/EWcBrybFmbr7jbMJUJGSUk?s=sh&p=a&iam=2";
  const directChatUrl =
    liveContacts?.whatsappUrl ||
    signup.directChatUrl ||
    "https://wa.me/201285694670";
  const instagramUrl =
    liveContacts?.instagramUrl ||
    signup.instagramUrl ||
    "https://www.instagram.com/terr3hop/";
  const tiktokUrl =
    liveContacts?.tiktokUrl ||
    (signup as any).tiktokUrl ||
    "https://www.tiktok.com/@terr3hop";

  const isAr = locale === "ar";

  const perks = isAr
    ? [
        "عروض وخصومات حصرية.",
        "أكواد خصم لأعضاء الجروب.",
        "أخبار المنتجات والـ New Drops.",
        "تفاصيل الخامات والتصميمات الجديدة.",
        "مفاجآت وهدايا من وقت للتاني.",
      ]
    : [
        "Exclusive offers and private discounts.",
        "Promo codes reserved for community members.",
        "Product previews and early New Drops announcements.",
        "Behind-the-scenes fabric & design details.",
        "Occasional surprises, gifts, and VIP perks.",
      ];

  return (
    <section
      dir={isAr ? "rtl" : "ltr"}
      aria-labelledby="signup-heading"
      className="border-t border-line-light bg-off-white py-16 sm:py-20 lg:py-24"
    >
      <Container>
        <Reveal className="mx-auto max-w-3xl">
          <div className="flex flex-col items-center text-center">
            {/* Main Headline */}
            <h2
              id="signup-heading"
              className="text-2xl sm:text-3xl md:text-4xl lg:text-[42px] font-black tracking-tight text-obsidian leading-tight max-w-2xl"
            >
              {isAr ? "عايز تعرف الجديد قبل أي حد؟" : "Want to know what's new before anyone else?"}
            </h2>

            {/* Sub-headline Paragraph */}
            <p className="mt-3.5 text-base sm:text-lg font-medium text-graphite max-w-xl leading-relaxed">
              {isAr
                ? "انضم لجروب TERRA HOP على واتساب وخليك دايمًا في الصورة!"
                : "Join the TERRA HOP WhatsApp community and stay in the loop!"}
            </p>

            {/* Structured Perks - Matching Image 2 style: clean typography directly on background with subtle dividers */}
            <div className="mt-8 w-full max-w-2xl border-t border-b border-line-light py-7 text-start">
              <div className="text-base sm:text-lg font-bold text-obsidian mb-4">
                {isAr ? "هنشارك معاكم كل جديد أول بأول:" : "Here's what we share first with you:"}
              </div>

              <ul className="space-y-3.5 sm:space-y-4 text-sm sm:text-base text-graphite">
                {perks.map((perk, idx) => (
                  <li key={idx} className="flex items-baseline gap-3.5">
                    <span className="font-display text-sm sm:text-base font-bold text-obsidian/70 tabular-nums select-none shrink-0">
                      {idx + 1}.
                    </span>
                    <span className="leading-relaxed text-obsidian/90 font-medium">{perk}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Summary & Urgency */}
            <div className="mt-8 text-center space-y-2 max-w-xl">
              <p className="text-base sm:text-lg font-bold text-obsidian leading-snug">
                {isAr
                  ? "يعني باختصار، كل جديد في TERRA HOP هيوصلك قبل غيرك!"
                  : "In short: everything new at TERRA HOP reaches you first!"}
              </p>
              <p className="text-xs sm:text-sm text-graphite leading-relaxed">
                {isAr
                  ? "متستناش لما يفوتك العرض.. انضم لينا دلوقتي وكون جزء من رحلتنا."
                  : "Don't miss out on the next drop.. join now and be part of our journey."}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full max-w-md">
              {/* Main Join Button with calm natural green */}
              <a
                href={whatsappGroupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#16a34a] hover:bg-[#15803d] px-7 py-3.5 text-sm sm:text-base font-bold text-white shadow-sm transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                <WhatsAppIcon className="h-5 w-5 fill-current" />
                <span>{isAr ? "انضم الآن" : "Join Now"}</span>
              </a>

              {/* Direct 1-on-1 Chat */}
              <a
                href={directChatUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-line-light bg-transparent hover:bg-black/5 px-5 py-3.5 text-xs sm:text-sm font-semibold text-obsidian transition-all cursor-pointer"
              >
                <WhatsAppIcon className="h-4 w-4 fill-current text-[#16a34a]" />
                <span>{isAr ? "أو تواصل معنا مباشرة" : "Chat with Support"}</span>
              </a>
            </div>

            {/* Slogan */}
            <p className="mt-7 text-[11px] sm:text-xs font-mono tracking-widest text-graphite/70 uppercase select-none">
              TERRA HOP — Designed to Be Different.
            </p>

            {/* Centered Socials: Only Icons, centered, without borders */}
            <div className="mt-5 flex items-center justify-center gap-4">
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram @terr3hop"
                className="p-2 text-graphite hover:text-obsidian transition-colors cursor-pointer"
              >
                <InstagramIcon className="w-5 h-5 fill-current" />
              </a>

              <a
                href={tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TikTok @terr3hop"
                className="p-2 text-graphite hover:text-obsidian transition-colors cursor-pointer"
              >
                <TikTokIcon className="w-5 h-5 fill-current" />
              </a>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
