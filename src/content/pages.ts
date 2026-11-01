import type { ImageSlot } from "./images";

// Content for Shop, About, Help and Cart. Same rule as home.ts: components get props only, every demo value is marked.
// Contact details (WhatsApp, email) are read from home.footer, so they live in one place.
export const pages = {
  shop: {
    demo: true,
    meta: { title: "Shop", description: "Every TERRA HOP piece. Oversized streetwear, small drops, confirmed by preorder." },
    heading: "Shop",
    text: "Every piece in the current drop. Small runs, confirmed by preorder.",
  },
  about: {
    demo: true,
    meta: { title: "About", description: "TERRA HOP makes oversized streetwear for young men in Egypt, in small drops." },
    heading: "About TERRA HOP",
    intro: "Oversized streetwear for young men in Egypt.",
    body: [
      "TERRA HOP releases small drops. Every piece is confirmed by preorder before production, so nothing is made that nobody asked for.",
      "We keep the range short and the fit oversized. The goal is simple: pieces you reach for every day.",
    ],
    image: "story" as ImageSlot,
    valuesHeading: "How we work",
    values: [
      { label: "Fit", value: "Oversized" },
      { label: "Release", value: "Small drops, confirmed by preorder" },
      { label: "Made for", value: "Young men in Egypt" },
    ],
    cta: { label: "Shop all pieces", href: "/shop" },
  },
  help: {
    demo: true,
    meta: { title: "Help", description: "Answers about ordering, preorders, delivery and returns at TERRA HOP." },
    heading: "Help",
    text: "Quick answers about ordering and delivery. Can't find yours? Message us.",
    faqHeading: "Questions",
    faq: [
      { q: "How do I order?", a: "Add pieces to your cart and place your order. We then contact you by phone or WhatsApp to confirm it." },
      { q: "What does preorder mean?", a: "A preorder piece is made after your order is confirmed. It ships when production is complete." },
      { q: "How do I pay?", a: "We confirm the payment method with you when we contact you about your order." },
      { q: "Which size should I pick?", a: "Our pieces are cut oversized. Take your usual size for a relaxed fit, or go one size down for a closer one." },
    ],
    shipping: {
      id: "shipping",
      heading: "Shipping and Returns",
      points: [
        { title: "Delivery", text: "Orders are delivered after we confirm them with you. Preorder pieces ship when production is complete." },
        { title: "Returns", text: "If something is wrong with your order, contact us and we will sort it out together." },
      ],
    },
    contactHeading: "Contact us",
    contactText: "Reach us on WhatsApp or by email.",
  },
  product: {
    demo: true,
    back: "Back to shop",
    sizeLabel: "Size",
    sizeError: "Error: choose a size first.",
    add: "Add to cart",
    added: "Added to cart.",
    viewCart: "View cart",
    detailsHeading: "Details",
    details: [
      { label: "Fit", value: "Oversized" },
      { label: "Release", value: "Small drops, confirmed by preorder" },
    ],
  },
  cart: {
    demo: true,
    meta: { title: "Cart", description: "Your TERRA HOP cart." },
    heading: "Cart",
    emptyTitle: "Your cart is empty.",
    emptyText: "Pick a piece from the current drop and it will show up here.",
    cta: { label: "Shop all pieces", href: "/shop" },
    size: "Size",
    quantity: "Quantity",
    remove: "Remove",
    subtotal: "Subtotal",
    note: "Delivery is confirmed with you after you place your order.",
    order: "Order on WhatsApp",
    orderIntro: "Hi TERRA HOP, I would like to order:",
    clear: "Clear cart",
  },
} as const;
