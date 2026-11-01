// Hoodies shown on the login page and hero rotation. Files live in public/login-hoodies/.
// Each hoodie has a custom streetwear tagline for rotating hero banner showcase.

export interface HoodieCaption {
  ar: {
    prefix: string;
    accent: string;
    sub: string;
  };
  en: {
    prefix: string;
    accent: string;
    sub: string;
  };
}

export interface LoginHoodie {
  src: string;
  name: string;
  glow: string;
  caption: HoodieCaption;
}

export const loginHoodies: LoginHoodie[] = [
  {
    src: "/login-hoodies/hoodie-dusty-blue.webp",
    name: "Dusty Blue",
    glow: "#34445c",
    caption: {
      ar: {
        prefix: "هدومك",
        accent: "بستايل مختلف",
        sub: "هوديز بجودة عالية وخامات مريحة",
      },
      en: {
        prefix: "YOUR LOOK,",
        accent: "A DIFFERENT VIBE",
        sub: "Premium quality hoodies made for ultimate comfort",
      },
    },
  },
  {
    src: "/login-hoodies/hoodie-offwhite.webp",
    name: "Off-White",
    glow: "#4a3b30",
    caption: {
      ar: {
        prefix: "بساطة",
        accent: "تخطف العين",
        sub: "قصة أوفرسايز وألوان مريحة لكل يوم",
      },
      en: {
        prefix: "SIMPLICITY THAT",
        accent: "CATCHES THE EYE",
        sub: "Relaxed oversized cut in versatile neutral tones",
      },
    },
  },
  {
    src: "/login-hoodies/hoodie-black.webp",
    name: "Black",
    glow: "#8a8680",
    caption: {
      ar: {
        prefix: "تميز",
        accent: "بأسلوبك",
        sub: "مجموعة الهوديز الجديدة من TERRA HOP",
      },
      en: {
        prefix: "STAND OUT IN",
        accent: "YOUR STYLE",
        sub: "The New Hoodie Collection by TERRA HOP",
      },
    },
  },
  {
    src: "/login-hoodies/hoodie-charcoal.webp",
    name: "Charcoal",
    glow: "#a39a8f",
    caption: {
      ar: {
        prefix: "حضور",
        accent: "يفرض نفسه",
        sub: "خامة قطن 100% ثقيلة وتطريز فاخر",
      },
      en: {
        prefix: "A PRESENCE THAT",
        accent: "OWNS THE ROOM",
        sub: "100% heavyweight cotton with luxury embroidery",
      },
    },
  },
  {
    src: "/login-hoodies/hoodie-chocolate.webp",
    name: "Chocolate",
    glow: "#c2b29c",
    caption: {
      ar: {
        prefix: "إطلالة",
        accent: "دافئة وفريدة",
        sub: "ألوان شتوية جريئة تناسب كل الأوقات",
      },
      en: {
        prefix: "A WARM &",
        accent: "UNIQUE LOOK",
        sub: "Rich seasonal tones crafted for day and night",
      },
    },
  },
  {
    src: "/login-hoodies/hoodie-forest.webp",
    name: "Forest Green",
    glow: "#a7b3a3",
    caption: {
      ar: {
        prefix: "طاقة",
        accent: "الشارع الحقيقية",
        sub: "كولكشن ستريت وير صُمم ليعبر عنك",
      },
      en: {
        prefix: "THE RAW",
        accent: "STREET ENERGY",
        sub: "Authentic streetwear crafted to speak your voice",
      },
    },
  },
  {
    src: "/login-hoodies/hoodie-washed-black.webp",
    name: "Washed Black",
    glow: "#8f949a",
    caption: {
      ar: {
        prefix: "لمسة",
        accent: "فينتاج أصلية",
        sub: "تأثير مغسول عصري لا يتكرر",
      },
      en: {
        prefix: "AN AUTHENTIC",
        accent: "VINTAGE TOUCH",
        sub: "Signature acid wash finish that never fades",
      },
    },
  },
  {
    src: "/login-hoodies/hoodie-deep-teal.webp",
    name: "Deep Teal",
    glow: "#b9ab97",
    caption: {
      ar: {
        prefix: "ستايل",
        accent: "يسبق جيله",
        sub: "تفاصيل دقيقة وتشطيب بأعلى المقاييس",
      },
      en: {
        prefix: "A STYLE THAT",
        accent: "LEADS THE WAVE",
        sub: "Obsessive details and master-grade tailoring",
      },
    },
  },
];

export const loginHoodieIntervalMs = 5000;
