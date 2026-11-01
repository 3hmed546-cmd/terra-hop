/**
 * The admin lives at a secret public path (NEXT_PUBLIC_ADMIN_PATH) that proxy.ts
 * rewrites to the internal /admin folder. Links must use the public path.
 */
const RAW = process.env.NEXT_PUBLIC_ADMIN_PATH ?? "admin";

export const ADMIN_BASE = `/${RAW.replace(/^\/+|\/+$/g, "")}`;

export function adminHref(path = ""): string {
  return `${ADMIN_BASE}${path}`;
}

/** "/x-panel/products/new" (or "/admin/products/new") -> "/products/new" */
export function relativeAdminPath(pathname: string, base: string = ADMIN_BASE): string {
  for (const prefix of [base, "/admin"]) {
    if (pathname === prefix) return "/";
    if (pathname.startsWith(`${prefix}/`)) return pathname.slice(prefix.length);
  }
  return pathname;
}

export function isNavActive(relativePath: string, itemPath: string): boolean {
  return relativePath === itemPath || relativePath.startsWith(`${itemPath}/`);
}
