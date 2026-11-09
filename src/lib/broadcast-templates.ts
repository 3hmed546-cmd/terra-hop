export interface BroadcastProductData {
  id?: string;
  slug: string;
  nameAr: string;
  priceCents: number;
  compareAtCents?: number | null;
  colors?: string[];
  sizes?: string[];
  descriptionAr?: string;
  details?: {
    material?: string;
    weight?: string;
    care?: string;
  };
  imageUrl?: string;
}

export function formatProductDetails(descriptionAr?: string, details?: any): string {
  if (descriptionAr && descriptionAr.trim()) {
    const raw = descriptionAr.trim();
    const lines = raw
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length > 1) {
      return lines
        .map((l) => (l.startsWith("-") || l.startsWith("•") || l.startsWith("*") ? l : `- ${l}`))
        .join("\n");
    }

    const sentences = raw
      .split(/(?<=[.!\n])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 3);

    if (sentences.length > 1) {
      return sentences
        .map((s) => (s.startsWith("-") || s.startsWith("•") || s.startsWith("*") ? s : `- ${s}`))
        .join("\n");
    }

    return `- ${raw}`;
  }

  const bullets: string[] = [];
  if (details?.material) bullets.push(`- خامة: ${details.material}.`);
  else bullets.push("- خامة قطن 100% عالية الجودة.");

  if (details?.weight) bullets.push(`- وزن: ${details.weight}.`);
  else bullets.push("- ملمس ثقيل ومريح وقصة متناسقة.");

  bullets.push("- تشطيب دقيق واهتمام بأدق التفاصيل.");
  return bullets.join("\n");
}

export function buildProductCaptionTemplate(
  product: BroadcastProductData,
  appBaseUrl = "https://terra-hop-production.up.railway.app"
): string {
  const priceEgp = Math.round(product.priceCents / 100);
  const compareAtEgp = product.compareAtCents ? Math.round(product.compareAtCents / 100) : null;
  const colorsText = product.colors?.length ? product.colors.join(" / ") : "متوفر بجميع الألوان";
  const sizesText = product.sizes?.length ? product.sizes.join(" – ") : "S – M – L – XL – XXL";
  const productUrl = `${appBaseUrl.replace(/\/$/, "")}/shop/${product.slug}`;
  const detailsText = formatProductDetails(product.descriptionAr, product.details);

  const priceLine = compareAtEgp
    ? `*السعر:* ${priceEgp} جنيه بدلًا من ${compareAtEgp} جنيه.`
    : `*السعر:* ${priceEgp} جنيه.`;

  return [
    `أهلًا بك في TERRA HOP.`,
    ``,
    `يسعدنا اهتمامك بمنتجاتنا. نقدم لك اليوم إحدى قطع مجموعتنا الجديدة:`,
    ``,
    `*${product.nameAr}*`,
    ``,
    priceLine,
    ``,
    `*الألوان المتاحة:* ${colorsText}`,
    ``,
    `*المقاسات:* ${sizesText}`,
    ``,
    `*تفاصيل المنتج:*`,
    detailsText,
    ``,
    `*تجربة الشراء:*`,
    ``,
    `نوفر لك إمكانية معاينة المنتج وتجربته عند الاستلام مع مندوب الشحن، قبل إتمام عملية الدفع.`,
    ``,
    `*لطلب المنتج:*`,
    `يمكنك اختيار مقاسك وإتمام طلبك مباشرة من خلال متجرنا الإلكتروني:`,
    ``,
    productUrl,
    ``,
    `نشكرك على اختيار TERRA HOP.`,
    ``,
    `Elegance in Every Detail.`,
    `Designed to Be Different.`,
  ].join("\n");
}

export function renderCaptionForCustomer(
  rawCaption: string,
  customer: { name?: string | null },
  product: BroadcastProductData,
  appBaseUrl = "https://terra-hop-production.up.railway.app"
): string {
  const priceEgp = Math.round(product.priceCents / 100);
  const compareAtEgp = product.compareAtCents ? Math.round(product.compareAtCents / 100) : null;
  const colorsText = product.colors?.length ? product.colors.join(" / ") : "متوفر بجميع الألوان";
  const sizesText = product.sizes?.length ? product.sizes.join(" – ") : "S – M – L – XL – XXL";
  const productUrl = `${appBaseUrl.replace(/\/$/, "")}/shop/${product.slug}`;
  const customerName = (customer.name || "").trim();

  let rendered = rawCaption;

  // Replace placeholders
  rendered = rendered.replace(/{customerName}|{اسم_العميل}|\[اسم العميل\]|\[الاسم\]/g, customerName || "عميلنا العزيز");
  rendered = rendered.replace(/{productName}|{اسم_المنتج}|\[اسم المنتج\]/g, product.nameAr);
  rendered = rendered.replace(/{price}|{السعر}|\[السعر\]/g, `${priceEgp} جنيه`);
  rendered = rendered.replace(/{colors}|{الألوان}|\[الألوان\]|\[الألوان المتاحة\]/g, colorsText);
  rendered = rendered.replace(/{sizes}|{المقاسات}|\[المقاسات\]/g, sizesText);
  rendered = rendered.replace(/{url}|{الرابط}|\[الرابط\]|\[رابط المنتج\]/g, productUrl);

  // Normalize markdown bold **text** to WhatsApp *text*
  rendered = rendered.replace(/\*\*(.*?)\*\*/g, "*$1*");

  return rendered;
}
