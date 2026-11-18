"use client";

import { Check, Sparkles } from "lucide-react";
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
      className="border-t border-stone-200/80 bg-off-white py-16 sm:py-20 lg:py-24"
    >
      <Container>
        <Reveal className="mx-auto max-w-3xl">
          {/* Unslop Minimalist Luxury Card - No muddy pastel gradients, crisp obsidian styling */}
          <div className="relative overflow-hidden rounded-3xl border border-neutral-800 bg-[#0d0d0d] p-6 sm:p-10 md:p-12 text-white shadow-2xl">
            {/* Subtle Top Accent Line */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#25D366] to-transparent opacity-80" />

            <div className="relative z-10 flex flex-col items-center text-center">
              {/* VIP Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/90 px-3.5 py-1.5 text-xs font-mono tracking-wider uppercase text-emerald-400 mb-5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>{isAr ? "مجتمع TERRA HOP VIP • واتساب" : "TERRA HOP VIP COMMUNITY • WHATSAPP"}</span>
              </div>

              {/* Hook Heading */}
              <h2
                id="signup-heading"
                className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-white leading-tight max-w-2xl"
              >
                {isAr ? "عايز تعرف الجديد قبل أي حد؟ 👀" : "Want to know what's new before anyone else? 👀"}
              </h2>

              {/* Sub-headline */}
              <p className="mt-3.5 text-base sm:text-lg font-medium text-stone-300 max-w-xl leading-relaxed">
                {isAr
                  ? "انضم لجروب TERRA HOP على واتساب وخليك دايمًا في الصورة!"
                  : "Join the TERRA HOP WhatsApp community and stay in the loop!"}
              </p>

              {/* Structured Perks Box */}
              <div className="mt-7 w-full max-w-xl rounded-2xl border border-neutral-800/90 bg-neutral-900/60 p-5 sm:p-6 text-start">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-stone-400 uppercase tracking-wider mb-3.5">
                  <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>{isAr ? "هنشارك معاكم كل جديد أول بأول:" : "Here's what we share first with you:"}</span>
                </div>

                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs sm:text-sm text-stone-200">
                  {perks.map((perk, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 mt-0.5 border border-emerald-500/20">
                        <Check className="h-3 w-3" />
                      </span>
                      <span className="leading-snug">{perk}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Value Summary & Urgency */}
              <div className="mt-6 text-center space-y-1.5 max-w-lg">
                <p className="text-sm sm:text-base font-bold text-stone-200">
                  {isAr
                    ? "يعني باختصار، كل جديد في TERRA HOP هيوصلك قبل غيرك!"
                    : "In short: everything new at TERRA HOP reaches you first!"}
                </p>
                <p className="text-xs sm:text-sm text-stone-400">
                  {isAr
                    ? "متستناش لما يفوتك العرض.. انضم لينا دلوقتي وكون جزء من رحلتنا."
                    : "Don't miss out on the next drop.. join now and be part of our journey."}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3.5 w-full max-w-md">
                {/* Main WhatsApp Button */}
                <a
                  href={whatsappGroupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center justify-center gap-3 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] px-7 py-3.5 text-sm sm:text-base font-black text-white shadow-lg shadow-emerald-950/50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <WhatsAppIcon className="h-5 w-5 fill-current transition-transform duration-200 group-hover:scale-110" />
                  <span>{isAr ? "انضم للجروب الآن" : "Join WhatsApp Group"}</span>
                  <span className="rounded-full bg-black/20 px-2 py-0.5 text-[11px] font-bold">
                    {isAr ? "دخول مباشر" : "Instant"}
                  </span>
                </a>

                {/* Direct 1-on-1 Chat */}
                <a
                  href={directChatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-700 bg-neutral-900/80 hover:bg-neutral-800 hover:border-neutral-600 px-5 py-3.5 text-xs sm:text-sm font-bold text-stone-300 hover:text-white transition-all cursor-pointer"
                >
                  <WhatsAppIcon className="h-4 w-4 fill-current text-emerald-400" />
                  <span>{isAr ? "أو تواصل معنا مباشرة" : "Chat with Support"}</span>
                </a>
              </div>

              {/* Slogan */}
              <p className="mt-6 text-[11px] sm:text-xs font-mono tracking-widest text-stone-400 uppercase select-none">
                TERRA HOP — Designed to Be Different.
              </p>

              {/* Centered Socials: TikTok & Instagram centered inside the card */}
              <div className="mt-7 pt-6 border-t border-neutral-800/80 w-full flex flex-col items-center justify-center">
                <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900/90 border border-neutral-800 hover:border-neutral-700 text-stone-300 hover:text-white transition-all text-xs sm:text-sm font-semibold group cursor-pointer"
                  >
                    <InstagramIcon className="w-4 h-4 text-stone-400 group-hover:text-pink-500 transition-colors" />
                    <span>Instagram: <strong className="text-white">@terr3hop</strong></span>
                  </a>

                  <a
                    href={tiktokUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900/90 border border-neutral-800 hover:border-neutral-700 text-stone-300 hover:text-white transition-all text-xs sm:text-sm font-semibold group cursor-pointer"
                  >
                    <TikTokIcon className="w-4 h-4 text-stone-400 group-hover:text-cyan-400 transition-colors" />
                    <span>TikTok: <strong className="text-white">@terr3hop</strong></span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
