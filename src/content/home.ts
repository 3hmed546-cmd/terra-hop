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
    products: [
      {
        slug: "oversized-burgundy-hoodie",
        name: "هودي عنابي أوفرسايز (Burgundy Oversized Hoodie)",
        category: "Hoodies",
        price: 1250,
        originalPrice: 1600,
        status: "Preorder",
        description: "هودي ستريت وير عنابي بقصة بوكسي دروب شولدر مريحة جداً، مصنوع من قطن مصري 100% ثقيل وفاخر (460 GSM). شعار TERRA HOP مطبوع بجودة عالية على الصدر.",
        sizes: ["S", "M", "L", "XL", "XXL"],
        images: ["/products/burgundy-hoodie-model.jpg", "/preview-images/look-3.jpg"],
        href: "/shop/oversized-burgundy-hoodie",
        demo: false,
      },
      {
        slug: "obsidian-puff-print-hoodie",
        name: "هودي أسود باف برينت (Obsidian Puff-Print Hoodie)",
        category: "Hoodies",
        price: 1290,
        originalPrice: 1650,
        status: "Preorder",
        description: "هودي ستريت وير أسود فاحم مزود بطباعة باف برينت مجسمة ثلاثية الأبعاد لشعار TERRA HOP على الصدر والظهر مع قبعة مزدوجة.",
        sizes: ["M", "L", "XL", "XXL"],
        images: ["/products/black-hoodie-model.jpg", "/preview-images/hoodie-1.jpg"],
        href: "/shop/obsidian-puff-print-hoodie",
        demo: false,
      },
      {
        slug: "vintage-cream-boxy-hoodie",
        name: "هودي كريمي بوكسي (Vintage Cream Boxy Hoodie)",
        category: "Hoodies",
        price: 1250,
        originalPrice: 1550,
        status: "Preorder",
        description: "هودي أوف وايت كريمي دافئ مريح بتطريز تايبوغرافي ناعم على الصدر وتصميم بوكسي واسع يناسب كل الإطلالات اليومية.",
        sizes: ["S", "M", "L", "XL"],
        images: ["/products/cream-hoodie-model.jpg", "/preview-images/look-2.jpg"],
        href: "/shop/vintage-cream-boxy-hoodie",
        demo: false,
      },
      {
        slug: "emerald-forest-heavyweight-hoodie",
        name: "هودي إميرالد أخضر زمردي (Emerald Heavyweight Hoodie)",
        category: "Hoodies",
        price: 1300,
        originalPrice: 1650,
        status: "Preorder",
        description: "درجة الأخضر الزمردي الغامق الفاخرة بقماش قطني متين ودافئ مع مظهر راقي وتطريز دقيق لشعار المتجر.",
        sizes: ["M", "L", "XL", "XXL"],
        images: ["/products/forest-hoodie-model.jpg", "/preview-images/look-5.jpg"],
        href: "/shop/emerald-forest-heavyweight-hoodie",
        demo: false,
      },
      {
        slug: "mocha-brown-acid-wash-hoodie",
        name: "هودي موكا براون أسيد (Mocha Brown Acid-Wash Hoodie)",
        category: "Hoodies",
        price: 1250,
        originalPrice: 1600,
        status: "Preorder",
        description: "لون بني موكا كلاسيكي بمظهر معتق جذاب مستوحى من أزياء الشارع العالمية مع أطراف مضلعة متماسكة.",
        sizes: ["S", "M", "L", "XL"],
        images: ["/products/brown-hoodie-model.jpg", "/preview-images/hoodie-2.jpg"],
        href: "/shop/mocha-brown-acid-wash-hoodie",
        demo: false,
      },
      {
        slug: "midnight-navy-raw-edge-hoodie",
        name: "هودي ميدنايت كحلي أوفرسايز (Midnight Navy Raw Hoodie)",
        category: "Hoodies",
        price: 1280,
        originalPrice: 1600,
        status: "Preorder",
        description: "أزرق كحلي ليلي غني ومميز بتصميم أوفرسايز مريح وشعار TERRA HOP مطرز باللون الأبيض الناصع.",
        sizes: ["M", "L", "XL", "XXL"],
        images: ["/products/navy-hoodie-model.jpg", "/preview-images/look-4.jpg"],
        href: "/shop/midnight-navy-raw-edge-hoodie",
        demo: false,
      },
      {
        slug: "charcoal-acid-hoodie",
        name: "هودي رمادي أسيد مغسول (Charcoal Acid-Wash Hoodie)",
        category: "Hoodies",
        price: 1280,
        originalPrice: 1600,
        status: "Preorder",
        description: "هودي ستريت وير رمادي فحمي مغسول بتأثير أسيد واش فريد يمنح كل قطعة مظهرًا استثنائيًا. مصنوع من قطن مصري 100% ثقيل (450 GSM)، غطاء رأس مزدوج، جيوب مقواة، وشعار TERRA HOP مطرز بدقة.",
        sizes: ["S", "M", "L", "XL", "XXL"],
        images: ["/login-hoodies/hoodie-charcoal.webp", "/login-hoodies/hoodie-washed-black.webp"],
        href: "/shop/charcoal-acid-hoodie",
        demo: false,
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
      tiktok: "https://www.tiktok.com/@teera.hop?_r=1&_t=ZS-9BJsTH7KSZu",
    },
    copyright: "TERRA HOP",
    tagline: "Higher on Purpose.",
  },
} as const;
