// Components read image paths, sizes and alt text from here, never from literals.
export type ImageAsset = { src: string; width: number; height: number; alt: string; demo: true };

const tile = (src: string, alt: string): ImageAsset => ({ src: `/preview-images/${src}.jpg`, width: 1080, height: 1350, alt, demo: true });
const hoodie = (file: string, alt: string): ImageAsset => ({ src: `/login-hoodies/${file}.webp`, width: 900, height: 1100, alt, demo: true });

// Premium product and lookbook imagery for TERRA HOP
export const images: Record<string, ImageAsset> = {
  hero: {
    src: "/preview-images/hero.jpg",
    width: 1932,
    height: 814,
    alt: "Young man with curly hair and sunglasses wearing a black TERRA HOP hoodie, seen from below on concrete steps with modern concrete buildings behind him",
    demo: true,
  },
  heroMobile: {
    src: "/preview-images/hero-mobile.jpg",
    width: 651,
    height: 814,
    alt: "Young man with curly hair and sunglasses wearing a black TERRA HOP hoodie, seen from below on concrete steps with modern concrete buildings behind him",
    demo: true,
  },
  // Hoodie models
  "hoodie-black": hoodie("hoodie-black", "موديل يرتدي هودي فانتوم أسود ملكي"),
  "hoodie-dusty-blue": hoodie("hoodie-dusty-blue", "موديل يرتدي هودي أزرق ترابي ستريت"),
  "hoodie-chocolate": hoodie("hoodie-chocolate", "موديل يرتدي هودي موكا بني شوكولاتة"),
  "hoodie-forest": hoodie("hoodie-forest", "موديل يرتدي هودي أخضر غابات ألبين"),
  "hoodie-charcoal": hoodie("hoodie-charcoal", "موديل يرتدي هودي رمادي فحمي مغسول"),
  "hoodie-deep-teal": hoodie("hoodie-deep-teal", "موديل يرتدي هودي أزرق بترولي تيل"),
  "hoodie-slate-navy": hoodie("hoodie-slate-navy", "موديل يرتدي هودي كحلي أردوازي"),
  "hoodie-sand-beige": hoodie("hoodie-sand-beige", "موديل يرتدي هودي بيج صحراوي رملي"),
  "hoodie-washed-black": hoodie("hoodie-washed-black", "موديل يرتدي هودي أسيد واش مغسول"),
  "hoodie-1": tile("hoodie-1", "الموديل يرتدي هودي ستريت وير أسود"),
  "hoodie-2": tile("hoodie-2", "هودي أسود بتطريز اللوجو الأمامي"),

  story: { src: "/preview-images/story.jpg", width: 1484, height: 1060, alt: "تشكيلة هوديز TERRA HOP الفاخرة", demo: true },

  // Lookbook model photography (Cleaned: no old tees or tags, only premium hoodies)
  "look-1": hoodie("hoodie-dusty-blue", "لوك بوك - هودي أزرق ترابي بستريت ستايل عصري"),
  "look-2": hoodie("hoodie-charcoal", "لوك بوك - هودي رمادي فحمي بتأثير مغسول فاخر"),
  "look-3": hoodie("hoodie-forest", "لوك بوك - هودي أخضر غابات فخم"),
  "look-4": hoodie("hoodie-chocolate", "لوك بوك - هودي موكا كاكاو فينتاج دافئ"),
  "look-5": hoodie("hoodie-black", "لوك بوك - هودي أسود ملكي فانتوم ستريت وير"),

  // Legacy fallback slots
  "tee-black-1": hoodie("hoodie-black", "هودي أسود"),
  "tee-black-2": tile("hoodie-2", "تفاصيل الهودي"),
  "tee-offwhite-1": hoodie("hoodie-sand-beige", "هودي بيج رملي"),
  "tee-offwhite-2": hoodie("hoodie-dusty-blue", "هودي أزرق"),
  "tee-grey-1": hoodie("hoodie-charcoal", "هودي رمادي"),
  "tee-grey-2": hoodie("hoodie-washed-black", "هودي أسيد واش"),
};

export type ImageSlot = string;

export function resolveImage(slotOrUrl: string): ImageAsset {
  const found = images[slotOrUrl];
  if (found) return found;
  return { src: slotOrUrl, width: 900, height: 1100, alt: "TERRA HOP Hoodie", demo: true };
}

export const logo = {
  src: "/logo/terra-hop-logo-white.png",
  width: 914,
  height: 351,
} as const;
