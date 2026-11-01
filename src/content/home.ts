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
        slug: "phantom-obsidian-hoodie",
        name: "Phantom Obsidian Hoodie",
        category: "Hoodies",
        price: 1250,
        originalPrice: 1550,
        status: "Preorder",
        description: "هودي ستريت وير أسود فاحم مصنوع من قطن مصري 100% ثقيل (450 GSM). غطاء رأس مزدوج، جيب كانغرو مبطن، وتطريز كوكبي فاخر عالي الكثافة على الصدر.",
        sizes: ["S", "M", "L", "XL", "XXL"],
        images: ["hoodie-black", "hoodie-1", "hoodie-2"],
        href: "/shop/phantom-obsidian-hoodie",
        demo: true,
      },
      {
        slug: "dusty-cobalt-hoodie",
        name: "Dusty Cobalt Streetwear Hoodie",
        category: "Hoodies",
        price: 1200,
        originalPrice: 1500,
        status: "Preorder",
        description: "لون أزرق ترابي استثنائي مستوحى من ألوان الشارع العصرية. قصة أوفرسايز دروب شولدر وأكمام مضلعة سميكة لراحة فائقة في كل حركة.",
        sizes: ["S", "M", "L", "XL", "XXL"],
        images: ["hoodie-dusty-blue", "hoodie-slate-navy"],
        href: "/shop/dusty-cobalt-hoodie",
        demo: true,
      },
      {
        slug: "vintage-mocha-hoodie",
        name: "Vintage Mocha Brown Hoodie",
        category: "Hoodies",
        price: 1200,
        originalPrice: 1500,
        status: "Preorder",
        description: "إطلالة شتوية غنية بلون الشوكولاتة العتيقة وتأثير فينتاج دافئ. قطن مغسول ناعم الملمس متين ومقاوم للوبر.",
        sizes: ["S", "M", "L", "XL", "XXL"],
        images: ["hoodie-chocolate", "hoodie-sand-beige"],
        href: "/shop/vintage-mocha-hoodie",
        demo: true,
      },
      {
        slug: "alpine-forest-hoodie",
        name: "Alpine Forest Green Hoodie",
        category: "Hoodies",
        price: 1250,
        originalPrice: 1550,
        status: "Preorder",
        description: "درجة خضراء غنية وفاخرة مع لوجو أبيض متباين. بطانة داخلية فائقة النعومة وتطريز متقن على المعصم والصدر.",
        sizes: ["S", "M", "L", "XL", "XXL"],
        images: ["hoodie-forest", "hoodie-deep-teal"],
        href: "/shop/alpine-forest-hoodie",
        demo: true,
      },
      {
        slug: "charcoal-acid-hoodie",
        name: "Charcoal Acid-Wash Hoodie",
        category: "Hoodies",
        price: 1280,
        originalPrice: 1600,
        status: "Preorder",
        description: "معالجة غسيل أسيد فريدة تعطي كل قطعة شخصية حصرية مستقلة. قصة دروب عريضة وجيوب معززة بدرزات ثلاثية.",
        sizes: ["S", "M", "L", "XL", "XXL"],
        images: ["hoodie-charcoal", "hoodie-washed-black"],
        href: "/shop/charcoal-acid-hoodie",
        demo: true,
      },
      {
        slug: "deep-ocean-teal-hoodie",
        name: "Deep Ocean Teal Hoodie",
        category: "Hoodies",
        price: 1200,
        originalPrice: 1500,
        status: "Preorder",
        description: "لون بترولي داكن عميق يجمع بين الغموض والأناقة المعاصرة. تصميم مينيمالي نقي مع تفاصيل متقنة وتشطيب فاخر.",
        sizes: ["S", "M", "L", "XL", "XXL"],
        images: ["hoodie-deep-teal", "hoodie-forest"],
        href: "/shop/deep-ocean-teal-hoodie",
        demo: true,
      },
      {
        slug: "midnight-slate-navy-hoodie",
        name: "Midnight Slate Navy Hoodie",
        category: "Hoodies",
        price: 1250,
        originalPrice: 1550,
        status: "Preorder",
        description: "تون كحلي أردوازي ملكي ثقيل بتشطيب قطن فاخر. أربطة هودي عريضة بحليات معدنية غير لامعة وغطاء رأس مبطن.",
        sizes: ["S", "M", "L", "XL", "XXL"],
        images: ["hoodie-slate-navy", "hoodie-dusty-blue"],
        href: "/shop/midnight-slate-navy-hoodie",
        demo: true,
      },
      {
        slug: "desert-sand-dunes-hoodie",
        name: "Desert Sand Dunes Hoodie",
        category: "Hoodies",
        price: 1180,
        originalPrice: 1480,
        status: "Preorder",
        description: "تون بيج رملي دافئ ومريح مناسب للإطلالات اليومية الهادئة. نسيج قطني ناعم جداً على البشرة ومقاوم للتجعد.",
        sizes: ["S", "M", "L", "XL", "XXL"],
        images: ["hoodie-sand-beige", "hoodie-chocolate"],
        href: "/shop/desert-sand-dunes-hoodie",
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
      { image: "look-1" as ImageSlot, href: "/shop/dusty-cobalt-hoodie" },
      { image: "look-2" as ImageSlot, href: "/shop/charcoal-acid-hoodie" },
      { image: "look-3" as ImageSlot, href: "/shop/alpine-forest-hoodie" },
      { image: "look-4" as ImageSlot, href: "/shop/vintage-mocha-hoodie" },
      { image: "look-5" as ImageSlot, href: "/shop/phantom-obsidian-hoodie" },
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
