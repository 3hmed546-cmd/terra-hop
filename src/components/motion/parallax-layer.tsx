"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import type { ReactNode } from "react";

// Hero photo moves slower than the page while scrolling. Slightly oversized so no edge shows.
export function ParallaxLayer({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 900], [0, 140]);
  const scale = useTransform(scrollY, [0, 900], [1.08, 1.18]);
  return (
    <motion.div className="absolute inset-0 -z-20" style={reduce ? undefined : { y, scale }}>
      {children}
    </motion.div>
  );
}
