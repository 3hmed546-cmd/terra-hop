"use client";

import React from "react";

interface HangerIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  withCircle?: boolean;
}

export function HangerIcon({
  className = "w-18 h-18 sm:w-22 sm:h-22",
  withCircle = true,
  ...props
}: HangerIconProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Black circular badge background */}
      {withCircle && <circle cx="50" cy="50" r="48" fill="#0D0D0D" />}

      {/* 1. White Upper Hook Loop */}
      <path
        d="M 42 33.5 C 41.5 26.5 50 22 56 25.5 C 60 28 60 33.5 56.5 37 C 54 39.5 52 41 51.5 44"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* 2. Gold Neck & Left Shoulder */}
      <path
        d="M 51.5 44 L 51 46.5 L 20 62.5 C 17 64 17.5 66.5 21.5 66.5 L 24.5 66.5"
        stroke="#C8A44D"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* 3. Gold Right Shoulder (separated with elegant slit/notch from neck) */}
      <path
        d="M 58 48.5 L 80 62.5 C 83 64 82.5 66.5 78.5 66.5 L 75.5 66.5"
        stroke="#C8A44D"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* 4. White Bottom Trouser Bar */}
      <line
        x1="29"
        y1="66.5"
        x2="71"
        y2="66.5"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
