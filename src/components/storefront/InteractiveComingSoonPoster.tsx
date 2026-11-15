"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";

interface InteractivePosterProps {
  desktopImage: string;
  mobileImage: string;
  title?: string;
}

const COMING_SOON_TEXT = "COMING SOON";

function BouncingComingSoonText({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-serif tracking-[0.18em] sm:tracking-[0.24em] uppercase select-none font-bold text-neutral-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.7)] flex items-center justify-center ${className}`}
      style={{
        fontFamily: "'Cinzel', 'Playfair Display', 'Didot', 'Bodoni MT', 'Georgia', serif",
      }}
    >
      {COMING_SOON_TEXT.split("").map((char, index) => {
        if (char === " ") {
          return (
            <span key={index} className="inline-block w-2 sm:w-3.5">
              &nbsp;
            </span>
          );
        }
        return (
          <span
            key={index}
            className="animate-letter-bounce hover:scale-125 transition-transform duration-200 cursor-pointer"
            style={{
              animationDelay: `${(index * 0.08).toFixed(2)}s`,
            }}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
}

export function InteractiveComingSoonPoster({
  desktopImage,
  mobileImage,
  title,
}: InteractivePosterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });
  const targetTilt = useRef({ x: 0, y: 0 });
  const animFrameId = useRef<number | null>(null);

  // Smooth animation loop for 3D tilt
  useEffect(() => {
    let currentX = 0;
    let currentY = 0;

    const loop = () => {
      currentX += (targetTilt.current.x - currentX) * 0.08;
      currentY += (targetTilt.current.y - currentY) * 0.08;
      setTilt({ x: currentX, y: currentY });
      animFrameId.current = requestAnimationFrame(loop);
    };

    animFrameId.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, []);

  // Handle pointer move for 3D perspective & dynamic light sheen
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Subtle 3D tilt
    const maxTilt = 4.5;
    const tiltY = ((x - centerX) / centerX) * maxTilt;
    const tiltX = -((y - centerY) / centerY) * maxTilt;

    targetTilt.current = { x: tiltX, y: tiltY };

    // Glare position in percentage
    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;
    setGlarePos({ x: glareX, y: glareY, opacity: 0.35 });
  }, []);

  const handlePointerLeave = useCallback(() => {
    targetTilt.current = { x: 0, y: 0 };
    setGlarePos((prev) => ({ ...prev, opacity: 0 }));
  }, []);

  // Optional Gyroscope support for mobile tilt
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma === null || e.beta === null) return;
      const clampedGamma = Math.max(-25, Math.min(25, e.gamma));
      const clampedBeta = Math.max(15, Math.min(65, e.beta)) - 40;

      targetTilt.current = {
        x: -(clampedBeta / 25) * 3.5,
        y: (clampedGamma / 25) * 3.5,
      };
    };

    if (typeof window !== "undefined" && "DeviceOrientationEvent" in window) {
      window.addEventListener("deviceorientation", handleOrientation, { passive: true });
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("deviceorientation", handleOrientation);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative w-full cursor-pointer select-none overflow-hidden"
      style={{ perspective: "1200px" }}
    >
      {/* 3D Tilted Wrapper */}
      <div
        className="relative w-full transition-transform duration-75 ease-out will-change-transform"
        style={{
          transform: `rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg) translateZ(0)`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* =========================================================================
            DESKTOP BANNER (>= sm):
            Full width (w-full max-w-none px-0) edge-to-edge.
           ========================================================================= */}
        <div className="hidden sm:block relative w-full max-w-none px-0 overflow-hidden bg-white shadow-[0_30px_90px_rgba(0,0,0,0.95)] border-b border-white/10">
          <div className="relative w-full aspect-[1920/1072] max-h-[70vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={desktopImage}
              alt={title || "TERRA HOP | تيرا هوب - براند مصري للأزياء والهوديز الأوفر سايز"}
              width={1920}
              height={1072}
              fetchPriority="high"
              loading="eager"
              decoding="async"
              className="w-full h-full object-cover object-center"
            />

            {/* Dynamic Bouncing & Shaking "COMING SOON" Letters Over Phone Screen */}
            <div
              className="pointer-events-auto absolute z-25 flex items-center justify-center"
              style={{
                top: "49.44%",
                left: "51.04%",
                transform: "translate(-50%, -50%)",
                width: "29%",
              }}
            >
              <BouncingComingSoonText className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-[42px] leading-none" />
            </div>

            {/* Specular Light Sheen Sweeping Over Phone Screen */}
            <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
              <div className="absolute inset-0 animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-70" />
            </div>

            {/* Interactive Cursor Glare Highlight */}
            <div
              className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-300"
              style={{
                opacity: glarePos.opacity,
                background: `radial-gradient(circle 380px at ${glarePos.x}% ${glarePos.y}%, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.08) 45%, transparent 70%)`,
              }}
            />
          </div>
        </div>

        {/* =========================================================================
            MOBILE TALL POSTER (< sm):
            Full width edge-to-edge (px-0), tall portrait aspect ratio (9:15 / 9:16).
           ========================================================================= */}
        <div className="block sm:hidden relative w-full px-0 overflow-hidden bg-white shadow-[0_20px_60px_rgba(0,0,0,0.9)] border-b border-white/10">
          <div className="relative w-full aspect-[1080/1920]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mobileImage}
              alt={title || "TERRA HOP | تيرا هوب - براند مصري للأزياء والهوديز الأوفر سايز"}
              width={1080}
              height={1920}
              fetchPriority="high"
              loading="eager"
              decoding="async"
              className="w-full h-full object-cover object-center"
            />

            {/* Dynamic Bouncing & Shaking "COMING SOON" Letters Over Phone Screen on Mobile */}
            <div
              className="pointer-events-auto absolute z-25 flex items-center justify-center"
              style={{
                top: "49.61%",
                left: "51.15%",
                transform: "translate(-50%, -50%)",
                width: "48%",
              }}
            >
              <BouncingComingSoonText className="text-[17px] xs:text-[20px] leading-none" />
            </div>

            {/* Specular Light Sheen Sweeping Over Mobile Phone Screen */}
            <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
              <div className="absolute inset-0 animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-75" />
            </div>

            {/* Subtle Interactive Tap/Touch Glow */}
            <div
              className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-300"
              style={{
                opacity: glarePos.opacity,
                background: `radial-gradient(circle 260px at ${glarePos.x}% ${glarePos.y}%, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.08) 50%, transparent 75%)`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
