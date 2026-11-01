import { logo } from "@/content/images";
import { uiStrings } from "@/lib/ui-strings";

// The logo is a white-on-transparent PNG used as a CSS mask, so it takes currentColor.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label={uiStrings.logoAlt}
      className={`block bg-current ${className}`}
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
