"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

const ease = [0.22, 1, 0.36, 1] as const;
const viewport = { once: true, margin: "0px 0px -80px 0px" } as const;

type RevealProps = { children: ReactNode; className?: string; delay?: number; y?: number };

// Fades and lifts its content into place the first time it scrolls into view.
export function Reveal({ children, className, delay = 0, y = 32 }: RevealProps) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewport}
      transition={{ duration: 0.8, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

// Same effect for <li> items. `index` staggers neighbours so a row of cards lands one after another.
export function RevealItem({
  children,
  className,
  index = 0,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <li className={className}>{children}</li>;
  return (
    <motion.li
      className={className}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={viewport}
      transition={{ duration: 0.7, delay: (index % 4) * 0.1, ease }}
    >
      {children}
    </motion.li>
  );
}

// Image wipes open from the top while it settles from a slight zoom.
export function ImageReveal({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={`overflow-hidden ${className ?? ""}`}
      initial={{ clipPath: "inset(0 0 100% 0)" }}
      whileInView={{ clipPath: "inset(0 0 0% 0)" }}
      viewport={viewport}
      transition={{ duration: 1.1, ease }}
    >
      <motion.div
        initial={{ scale: 1.2 }}
        whileInView={{ scale: 1 }}
        viewport={viewport}
        transition={{ duration: 1.4, ease }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
