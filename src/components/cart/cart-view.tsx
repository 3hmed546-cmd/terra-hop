"use client";

import Image from "next/image";
import Link from "next/link";
import { ButtonLink, Button } from "@/components/ui/button";
import { images } from "@/content/images";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { useLocale } from "@/lib/locale-context";
import type { Product } from "@/content/home";

type Props = { products: Product[] };

const qtyBtn =
  "grid h-11 w-11 place-items-center rounded-control border border-graphite text-lg leading-none transition-colors duration-200 hover:border-obsidian disabled:opacity-40";

export function CartView({ products }: Props) {
  const { lines, setQty, remove, clear } = useCart();
  const { t } = useLocale();

  const rows = lines.flatMap((l) => {
    const product = products.find((p) => p.slug === l.slug);
    return product ? [{ ...l, product }] : [];
  });

  if (rows.length === 0) {
    return (
      <div className="mt-10 border-t border-line-light pt-10">
        <p role="status" className="text-h2">
          {t.cart.emptyTitle}
        </p>
        <p className="mt-3 max-w-[50ch] text-graphite">{t.cart.emptyText}</p>
        <ButtonLink href="/shop" className="mt-8">
          {t.cart.cta}
        </ButtonLink>
      </div>
    );
  }

  const subtotal = rows.reduce((sum, r) => sum + r.product.price * r.qty, 0);

  return (
    <div className="mt-10 grid gap-12 lg:grid-cols-12 items-start">
      <ul className="border-b border-line-light lg:col-span-8">
        {rows.map(({ product, size, qty }) => {
          const firstImg = product.images[0];
          const isDirectUrl = typeof firstImg === "string" && (firstImg.startsWith("/") || firstImg.startsWith("http"));
          const matchedImg = isDirectUrl ? null : images[firstImg];
          const imgSrc = isDirectUrl ? firstImg : (matchedImg?.src || "/products/burgundy-hoodie-model.jpg");
          const imgAlt = matchedImg?.alt || product.name;
          const translatedName = t.products[product.slug]?.name || product.name;

          return (
            <li
              key={`${product.slug}-${size}`}
              className="flex gap-4 border-t border-line-light py-6 sm:gap-6"
            >
              <Link href={product.href} className="block w-24 shrink-0 sm:w-32">
                <Image
                  src={imgSrc}
                  alt={imgAlt}
                  width={900}
                  height={1100}
                  sizes="128px"
                  className="aspect-[4/5] w-full bg-charcoal object-cover"
                />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold">
                      <Link href={product.href} className="underline-offset-4 hover:underline">
                        {translatedName}
                      </Link>
                    </h2>
                    <p className="text-sm text-graphite">
                      {t.cart.size}: <span className="font-mono font-bold text-obsidian">{size}</span>
                    </p>
                  </div>
                  <p className="tabular-nums font-mono font-bold text-obsidian">
                    {formatPrice(product.price * qty)}
                  </p>
                </div>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
                  <div
                    role="group"
                    aria-label={`${t.cart.quantity}: ${translatedName}, ${t.cart.size} ${size}`}
                    className="flex items-center gap-2"
                  >
                    <button
                      type="button"
                      className={qtyBtn}
                      aria-label={`- ${translatedName}`}
                      onClick={() => setQty(product.slug, size, qty - 1)}
                    >
                      &minus;
                    </button>
                    <span className="w-8 text-center tabular-nums font-mono" aria-live="polite">
                      {qty}
                    </span>
                    <button
                      type="button"
                      className={qtyBtn}
                      aria-label={`+ ${translatedName}`}
                      disabled={qty >= 10}
                      onClick={() => setQty(product.slug, size, qty + 1)}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="text-label min-h-11 underline underline-offset-4 text-graphite hover:text-obsidian"
                    onClick={() => remove(product.slug, size)}
                  >
                    {t.cart.remove}
                    <span className="sr-only">
                      {" "}
                      {translatedName}, {t.cart.size} {size}
                    </span>
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="lg:col-span-4 rounded border border-line-light bg-off-white p-6 space-y-4">
        <div className="flex items-baseline justify-between border-b border-obsidian pb-3">
          <p className="text-label text-graphite">{t.cart.subtotal}</p>
          <p className="text-h3 tabular-nums font-mono font-bold text-obsidian">
            {formatPrice(subtotal)}
          </p>
        </div>

        <p className="text-xs text-graphite leading-relaxed">{t.cart.note}</p>

        {/* Direct Checkout button (No WhatsApp!) */}
        <ButtonLink href="/checkout" className="mt-4 w-full text-center py-3.5 font-bold">
          {t.cart.checkout}
        </ButtonLink>

        <Button variant="secondary" onClick={clear} className="w-full text-xs">
          {t.cart.clear}
        </Button>
      </aside>
    </div>
  );
}
