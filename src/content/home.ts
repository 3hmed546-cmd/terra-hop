import type { ImageSlot } from "./images";

// All homepage content lives here. Shapes mirror the future home_sections config. Every demo value carries demo: true.
export type NavLink = { label: string; href: string };
export type Category = "T-shirts" | "Hoodies";
export type Product = {
  slug: string;
  name: string;
  category: Category;
  price: number;
  originalPrice?: number;
  status?: string;
  description: string;
  sizes: readonly string[];
  images: readonly ImageSlot[];
  href: string;
  demo: true;
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
    whatsapp: { label: "WhatsApp", href: "https://wa.me/201285694670" },
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
    products: [
      {
        slug: "black-oversized-tee",
        name: "Black Oversized Tee",
        category: "T-shirts",
        price: 650,
        originalPrice: 850,
        status: "Preorder",
        description: "Heavy cotton jersey, dropped shoulders and a boxy oversized cut. A small chest logo and nothing else.",
        sizes: ["S", "M", "L", "XL", "XXL"],
        images: ["tee-black-1", "tee-black-2", "look-3", "look-4"],
        href: "/shop/black-oversized-tee",
        demo: true,
      },
      {
        slug: "off-white-graphic-tee",
        name: "Off-White Graphic Tee",
        category: "T-shirts",
        price: 650,
        originalPrice: 850,
        description: "Soft off-white cotton with a relaxed oversized fit. Made to be worn loose over everything.",
        sizes: ["S", "M", "L", "XL", "XXL"],
        images: ["tee-offwhite-1", "tee-offwhite-2", "look-1", "story"],
        href: "/shop/off-white-graphic-tee",
        demo: true,
      },
      {
        slug: "black-oversized-hoodie",
        name: "Black Oversized Hoodie",
        category: "Hoodies",
        price: 1100,
        originalPrice: 1400,
        description: "Thick brushed fleece, deep hood and a roomy kangaroo pocket. Oversized through the body and sleeves.",
        sizes: ["S", "M", "L", "XL", "XXL"],
        images: ["hoodie-1", "hoodie-2", "look-2", "look-5"],
        href: "/shop/black-oversized-hoodie",
        demo: true,
      },
      {
        slug: "washed-grey-tee",
        name: "Washed Grey Tee",
        category: "T-shirts",
        price: 600,
        originalPrice: 750,
        description: "A washed grey tee with a lived-in feel from the first day. Oversized cut, soft hand.",
        sizes: ["S", "M", "L", "XL", "XXL"],
        images: ["tee-grey-1", "tee-grey-2", "look-1", "story"],
        href: "/shop/washed-grey-tee",
        demo: true,
      },
    ] satisfies Product[],
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
  lookbook: {
    demo: true,
    heading: "Lookbook",
    items: [
      { image: "look-1" as ImageSlot, href: "/shop" },
      { image: "look-2" as ImageSlot },
      { image: "look-3" as ImageSlot, href: "/shop" },
      { image: "look-4" as ImageSlot },
      { image: "look-5" as ImageSlot },
    ] as { image: ImageSlot; href?: string }[],
  },
  signup: {
    demo: true,
    whatsappGroupUrl: "https://chat.whatsapp.com/EWcBrybFmbr7jbMJUJGSUk?s=cl&p=a&iam=2",
    whatsappNumber: "+20 128 569 4670",
    directChatUrl: "https://wa.me/201285694670",
    instagramUrl: "https://instagram.com/terra_hop",
  },
  footer: {
    demo: true,
    columns: [
      [{ label: "Shop", href: "/shop" }, { label: "About", href: "/about" }, { label: "Help", href: "/help" }],
      [{ label: "Shipping and Returns", href: "/help#shipping" }, { label: "Privacy", href: STANDIN }, { label: "Terms", href: STANDIN }],
    ] as NavLink[][],
    whatsapp: "+20 128 569 4670",
    phone: "01285694670",
    email: "hello@example.com",
    instagram: { label: "Instagram", href: "https://instagram.com/" },
    whatsappHref: "https://wa.me/201285694670",
    socials: {
      whatsapp: "https://wa.me/201285694670",
      instagram: "https://instagram.com/",
      facebook: "https://facebook.com/",
      tiktok: "https://tiktok.com/",
    },
    copyright: "TERRA HOP",
    tagline: "Higher on Purpose.",
  },
} as const;
