export function Divider({ className = "" }: { className?: string }) {
  return <hr className={`border-0 border-t border-line-light in-[.on-dark]:border-charcoal ${className}`} />;
}
