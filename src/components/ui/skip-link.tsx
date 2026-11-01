import { uiStrings } from "@/lib/ui-strings";

export function SkipLink() {
  return (
    <a
      href="#main"
      className="fixed left-4 top-4 z-50 -translate-y-24 rounded-control bg-obsidian px-4 py-3 text-sm font-semibold text-off-white focus:translate-y-0"
    >
      {uiStrings.skipLink}
    </a>
  );
}
