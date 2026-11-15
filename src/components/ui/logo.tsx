import { logo } from "@/content/images";
import { uiStrings } from "@/lib/ui-strings";

// The logo is a white-on-transparent PNG used as a CSS mask, so it takes currentColor or custom background.
export function Logo({ className = "" }: { className?: string }) {
  const hasCustomBg = className.includes("bg-");
  return (
    <span
      role="img"
      aria-label={uiStrings.logoAlt}
      className={`block ${hasCustomBg ? "" : "bg-current"} ${className}`}
      style={{
        aspectRatio: `${logo.width} / ${logo.height}`,
        maskImage: `url(${logo.src})`,
        WebkitMaskImage: `url(${logo.src})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}
