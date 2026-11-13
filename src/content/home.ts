import type { ImageSlot } from "./images";

// All homepage content lives here. Shapes mirror the future home_sections config. Every demo value carries demo: true.
export type NavLink = { label: string; href: string };
export type Category = "T-shirts" | "Hoodies" | "Pants";
export type Product = {
  slug: string;
  name: string;
  category: Category;
  price: number;
  originalPrice?: number;
  status?: string;
  description: string;
  sizes: readonly string[];
  images: readonly (ImageSlot | string)[];
  href: string;
  demo?: boolean;
  details?: any;
  colors?: any[];
  variants?: any[];
};

const STANDIN = "/not-in-preview";

export const home = {
  meta: {
    demo: true,
    title: "TERRA HOP",
    description: "Oversized streetwear for young men in Egypt. Small drops, confirmed by preorder.",
  },
  header: {
    demo: true,
    links: [
      { label: "Shop", href: "/shop" },
      { label: "About", href: "/about" },
      { label: "Help", href: "/help" },
    ] satisfies NavLink[],
    cart: { label: "Cart", count: 0, href: "/cart" },
    whatsapp: { label: "WhatsApp", href: "https://chat.whatsapp.com/EWcBrybFmbr7jbMJUJGSUk?s=sh&p=a&iam=2" },
    homeHref: "/",
  },
  hero: {
    demo: true,
    label: "Drop 01",
    status: "Preorder open",
    cta: { label: "Preorder", href: "/shop" },
    image: "hero" as const,
  },
  ticker: {
    demo: true,
    items: [
      "اشتري 2 وخد شحن مجاني",
      "معاينة وقياس قبل الاستلام والدفع",
      "الدفع عند الاستلام",
      "عروض حصرية على كولكشن DROP 01",
      "شحن سريع لجميع أنحاء مصر",
      "كميات حصرية محدودة",
    ] as const,
  },
  drop: {
    demo: true,
    heading: "The Drop",
    viewAll: { label: "View all", href: "/shop" },
    categories: ["All", "T-shirts", "Hoodies"] as const,
    emptyMessage: "The first drop is coming soon.",
    products: [] satisfies Product[],
  },
  brandStory: {
    demo: true,
    heading: "خليك على طبيعتك.. والبس بطريقتك.",
    body: "في TERRA HOP بنقدملك قطع مختارة بعناية، بتجمع بين الراحة والتصميم العصري. من أول تفصيلة لآخر خروجة، خليك دائمًا مميز بأسلوبك.",
    image: "story" as const,
  },
  quality: {
    demo: true,
    heading: "Details",
    specs: [
      { label: "Fit", value: "Oversized" },
      { label: "Release", value: "Small drops, confirmed by preorder" },
    ],
    steps: [
      { title: "Place your order", text: "Add pieces to your cart and place your order." },
      { title: "We confirm", text: "We contact you by phone or WhatsApp to confirm." },
      { title: "Delivery", text: "Your order is delivered. Preorder pieces ship when production is complete." },
    ],
    link: { label: "Shop all pieces", href: "/shop" },
  },
  signup: {
    demo: true,
    whatsappGroupUrl: "https://chat.whatsapp.com/EWcBrybFmbr7jbMJUJGSUk?s=sh&p=a&iam=2",
    whatsappNumber: "+20 128 569 4670",
    directChatUrl: "https://wa.me/201285694670",
    instagramUrl: "https://www.instagram.com/terr3hop/",
  },
  footer: {
    demo: true,
    columns: [
      [{ label: "Shop", href: "/shop" }, { label: "About", href: "/about" }, { label: "Help", href: "/help" }],
      [{ label: "Shipping and Returns", href: "/help#shipping" }, { label: "Privacy", href: STANDIN }, { label: "Terms", href: STANDIN }],
    ] as NavLink[][],
    whatsapp: "+20 128 569 4670",
    phone: "01285694670",
    email: "support@terra-hop.com",
    instagram: { label: "Instagram", href: "https://www.instagram.com/terr3hop/" },
    whatsappHref: "https://chat.whatsapp.com/EWcBrybFmbr7jbMJUJGSUk?s=sh&p=a&iam=2",
    socials: {
      whatsapp: "https://chat.whatsapp.com/EWcBrybFmbr7jbMJUJGSUk?s=sh&p=a&iam=2",
      instagram: "https://www.instagram.com/terr3hop/",
      facebook: "https://www.facebook.com/terrahop.wear",
      tiktok: "https://www.tiktok.com/@terr3hop",
    },
    copyright: "TERRA HOP",
    tagline: "Higher on Purpose.",
  },
} as const;
