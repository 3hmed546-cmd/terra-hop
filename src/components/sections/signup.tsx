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
      className="border-t border-stone-200/80 bg-off-white py-16 sm:py-20 lg:py-24"
    >
      <Container>
        <Reveal className="mx-auto max-w-3xl">
          {/* Clean White Card Design matching site aesthetic */}
          <div className="relative overflow-hidden rounded-3xl border border-stone-200/90 bg-white p-6 sm:p-10 md:p-12 text-stone-900 shadow-sm">
            <div className="relative z-10 flex flex-col items-center text-center">
              {/* Main Headline */}
              <h2
                id="signup-heading"
                className="text-2xl sm:text-3xl md:text-4xl lg:text-[40px] font-black tracking-tight text-stone-950 leading-tight max-w-2xl"
              >
                {isAr ? "عايز تعرف الجديد قبل أي حد؟" : "Want to know what's new before anyone else?"}
              </h2>

              {/* Sub-headline Paragraph */}
              <p className="mt-3 text-base sm:text-lg font-medium text-stone-600 max-w-xl leading-relaxed">
                {isAr
                  ? "انضم لجروب TERRA HOP على واتساب وخليك دايمًا في الصورة!"
                  : "Join the TERRA HOP WhatsApp community and stay in the loop!"}
              </p>

              {/* Structured Perks Box - Clean list with title and simple bullet dots */}
              <div className="mt-7 w-full max-w-xl rounded-2xl border border-stone-200 bg-stone-50/80 p-5 sm:p-6 text-start">
                <div className="text-sm sm:text-base font-bold text-stone-900 mb-3.5">
                  {isAr ? "هنشارك معاكم كل جديد أول بأول:" : "Here's what we share first with you:"}
                </div>

                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs sm:text-sm text-stone-700">
                  {perks.map((perk, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="text-[#16a34a] font-bold text-base leading-none select-none">•</span>
                      <span className="leading-snug">{perk}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Summary & Urgency */}
              <div className="mt-6 text-center space-y-1.5 max-w-lg">
                <p className="text-sm sm:text-base font-bold text-stone-900">
                  {isAr
                    ? "يعني باختصار، كل جديد في TERRA HOP هيوصلك قبل غيرك!"
                    : "In short: everything new at TERRA HOP reaches you first!"}
                </p>
                <p className="text-xs sm:text-sm text-stone-500">
                  {isAr
                    ? "متستناش لما يفوتك العرض.. انضم لينا دلوقتي وكون جزء من رحلتنا."
                    : "Don't miss out on the next drop.. join now and be part of our journey."}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full max-w-md">
                {/* Main Join Button with calm natural green */}
                <a
                  href={whatsappGroupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-[#16a34a] hover:bg-[#15803d] px-7 py-3.5 text-sm sm:text-base font-bold text-white shadow-sm transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  <WhatsAppIcon className="h-5 w-5 fill-current" />
                  <span>{isAr ? "انضم الآن" : "Join Now"}</span>
                </a>

                {/* Direct 1-on-1 Chat */}
                <a
                  href={directChatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-300 bg-stone-50 hover:bg-stone-100 px-5 py-3.5 text-xs sm:text-sm font-semibold text-stone-700 hover:text-stone-950 transition-all cursor-pointer"
                >
                  <WhatsAppIcon className="h-4 w-4 fill-current text-[#16a34a]" />
                  <span>{isAr ? "أو تواصل معنا مباشرة" : "Chat with Support"}</span>
                </a>
              </div>

              {/* Slogan */}
              <p className="mt-6 text-[11px] sm:text-xs font-mono tracking-widest text-stone-400 uppercase select-none">
                TERRA HOP — Designed to Be Different.
              </p>

              {/* Centered Socials: Only Icons, centered, without borders, fully functional */}
              <div className="mt-6 pt-5 border-t border-stone-200/80 w-full flex items-center justify-center">
                <div className="flex items-center justify-center gap-4">
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram @terr3hop"
                    className="p-2.5 rounded-full text-stone-500 hover:text-pink-600 hover:bg-stone-100 transition-all cursor-pointer"
                  >
                    <InstagramIcon className="w-5 h-5 fill-current" />
                  </a>

                  <a
                    href={tiktokUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="TikTok @terr3hop"
                    className="p-2.5 rounded-full text-stone-500 hover:text-stone-950 hover:bg-stone-100 transition-all cursor-pointer"
                  >
                    <TikTokIcon className="w-5 h-5 fill-current" />
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
