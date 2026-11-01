// Components read image paths, sizes and alt text from here, never from literals.
export type ImageAsset = { src: string; width: number; height: number; alt: string; demo: true };

const tile = (src: string, alt: string): ImageAsset => ({ src: `/preview-images/${src}.jpg`, width: 1080, height: 1350, alt, demo: true });

// Gray tiles are placeholders. Replace a file in public/preview-images/ with the owner's photo (same name) and update alt text here.
export const images = {
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
  "tee-black-1": tile("tee-black-1", "Black oversized T-shirt with a small chest logo, flat front view"),
  "tee-black-2": tile("tee-black-2", "Close-up of a black T-shirt collar with a woven label"),
  "tee-offwhite-1": tile("tee-offwhite-1", "Man in sunglasses wearing an off-white oversized T-shirt"),
  "tee-offwhite-2": tile("tee-offwhite-2", "White oversized T-shirt with a small chest print, laid on dark stone"),
  "hoodie-1": tile("hoodie-1", "Man wearing a black oversized hoodie, front view"),
  "hoodie-2": tile("hoodie-2", "Black oversized hoodie with a small chest logo, flat front view"),
  "tee-grey-1": tile("tee-grey-1", "Washed grey T-shirt, front view"),
  "tee-grey-2": tile("tee-grey-2", "Washed grey T-shirt, worn, side view"),
  story: { src: "/preview-images/story.jpg", width: 1484, height: 1060, alt: "Placeholder: a beige hoodie, a black T-shirt, a white T-shirt and a cap laid out on dark stone", demo: true },
  "look-1": tile("look-1", "Man pulling a black top over a white T-shirt, seen from behind"),
  "look-2": tile("look-2", "Back of a beige hoodie with a large printed graphic"),
  "look-3": tile("look-3", "Close-up of an embroidered planet logo on black fabric"),
  "look-4": tile("look-4", "Close-up of a black T-shirt collar with a woven neck label"),
  "look-5": tile("look-5", "Young man in a black hoodie and cargo trousers standing in a concrete room"),
} satisfies Record<string, ImageAsset>;

export type ImageSlot = keyof typeof images;

export const logo = {
  src: "/logo/terra-hop-logo-white.png",
  width: 914,
  height: 351,
} as const;
