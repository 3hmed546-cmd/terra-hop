"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import type { ReactNode } from "react";

// One full cycle = 5 seconds: wipe in (1 s), hold (3 s), wipe out (1 s), then it starts again.
const PERIOD = 5;
const times = [0, 0.2, 0.8, 1];
const loop = { duration: PERIOD, repeat: Infinity, ease: "easeInOut" as const };

// Hero logo: repeats its reveal every 5 seconds, and drifts up and fades as the page scrolls.
export function AnimatedLogo({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 500], [0, -90]);
  const opacity = useTransform(scrollY, [0, 400], [1, 0]);

  if (reduce) return <div>{children}</div>;

  return (
    <motion.div style={{ y, opacity }}>
      <div className="relative">
        <motion.div
          style={{ willChange: "transform, clip-path", transform: "translateZ(0)" }}
          animate={{
            clipPath: ["inset(0 100% 0 0)", "inset(0 0% 0 0)", "inset(0 0% 0 0)", "inset(0 0% 0 100%)"],
            y: [24, 0, 0, -12],
          }}
          transition={{ ...loop, times }}
        >
          {children}
        </motion.div>
        {/* Flat Off-White edge that rides the wipe, in and out. */}
        <motion.span
          aria-hidden="true"
          className="absolute inset-y-0 w-[3px] bg-off-white pointer-events-none"
          animate={{
            left: ["0%", "100%", "0%", "0%", "0%", "100%"],
            opacity: [1, 1, 0, 0, 1, 1],
          }}
          transition={{ ...loop, times: [0, 0.2, 0.21, 0.8, 0.81, 1], ease: "linear" }}
        />
      </div>
    </motion.div>
  );
}
