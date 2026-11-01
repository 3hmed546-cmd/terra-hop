"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";

// Header cart link with shopping bag icon, live count, and Framer Motion addition bounce
export function CartLink({
  href,
  label,
  className = "",
  showIcon = true,
}: {
  href: string;
  label: string;
  className?: string;
  showIcon?: boolean;
}) {
  const { count } = useCart();
  const [isBouncing, setIsBouncing] = useState(false);
  const prevCountRef = useRef(count);

  useEffect(() => {
    // Animate only when items are added to cart
    if (count > prevCountRef.current) {
      setIsBouncing(true);
      const timer = setTimeout(() => setIsBouncing(false), 700);
      return () => clearTimeout(timer);
    }
    prevCountRef.current = count;
  }, [count]);

  return (
    <Link href={href} className={`inline-flex items-center gap-1.5 ${className}`}>
      <motion.div
        animate={
          isBouncing
            ? {
                scale: [1, 1.4, 0.85, 1.2, 0.95, 1],
                rotate: [0, -14, 14, -8, 4, 0],
              }
            : { scale: 1, rotate: 0 }
        }
        transition={{ duration: 0.65, ease: "easeInOut" }}
        className="relative inline-flex items-center justify-center"
      >
        {showIcon && <ShoppingBag size={17} className="shrink-0" aria-hidden="true" />}
      </motion.div>
      <span className="flex items-center">
        <span>{label}</span>
        <motion.span
          key={count}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 450, damping: 14 }}
          className="ml-1 inline-block tabular-nums font-semibold"
        >
          ({count})
        </motion.span>
      </span>
    </Link>
  );
}
