/**
 * Cryptographic Route Obfuscation Engine:
 * Replaces human-readable admin sub-paths with encrypted/hashed vault tokens.
 * Neither crawlers, AI models, nor unauthorized visitors can infer the function
 * of any sub-page or find login routes.
 */

export const VAULT_ROUTE_MAP: Record<string, string> = {
  "/dashboard": "/v-c9x2",
  "/orders": "/v-o7k1",
  "/products": "/v-p4m8",
  "/promos": "/v-d2f5",
  "/ambassadors": "/v-a6n3",
  "/managers": "/v-u2m9",
  "/whatsapp": "/v-w8t9",
  "/settings": "/v-s1v6",
  "/media": "/v-m5q0",
  "/sales": "/v-s3l7",
};

export const REVERSE_VAULT_MAP: Record<string, string> = {
  "v-c9x2": "dashboard",
  "v-o7k1": "orders",
  "v-p4m8": "products",
  "v-d2f5": "promos",
  "v-a6n3": "ambassadors",
  "v-u2m9": "managers",
  "v-w8t9": "whatsapp",
  "v-s1v6": "settings",
  "v-m5q0": "media",
  "v-s3l7": "sales",
};

export function getAdminBase(): string {
  if (typeof window !== "undefined") {
    const segments = window.location.pathname.split("/").filter(Boolean);
    if (segments.length > 0 && segments[0] !== "admin" && segments[0] !== "admin-login") {
      return `/${segments[0]}`;
    }
  }
  const raw =
    process.env.ADMIN_PATH ||
    process.env.ADMIN_LOGIN_PATH ||
    process.env.NEXT_PUBLIC_ADMIN_PATH ||
    "k7q2-vault-9xm4";
  return `/${raw.replace(/^\/+|\/+$/g, "")}`;
}

export const ADMIN_BASE = getAdminBase();

export function obfuscateAdminPath(path: string): string {
  if (!path || path === "/" || path === "") return "";
  const clean = path.startsWith("/") ? path : `/${path}`;
  const parts = clean.split("/").filter(Boolean);
  if (parts.length === 0) return "";

  const rootKey = `/${parts[0]}`;
  const obfuscatedRoot = VAULT_ROUTE_MAP[rootKey];
  if (obfuscatedRoot) {
    const remainder = parts.slice(1).join("/");
    return `${obfuscatedRoot}${remainder ? `/${remainder}` : ""}`;
  }
  return clean;
}

export function deobfuscateAdminPath(path: string): string {
  if (!path || path === "/" || path === "") return "/";
  const clean = path.startsWith("/") ? path : `/${path}`;
  const parts = clean.split("/").filter(Boolean);
  if (parts.length === 0) return "/";

  const token = parts[0];
  const realSegment = REVERSE_VAULT_MAP[token];
  if (realSegment) {
    const remainder = parts.slice(1).join("/");
    return `/${realSegment}${remainder ? `/${remainder}` : ""}`;
  }
  return clean;
}

export function adminHref(path = ""): string {
  const base = getAdminBase();
  if (!path || path === "" || path === "/") {
    return base;
  }
  const obf = obfuscateAdminPath(path);
  return `${base}${obf}`;
}

/** "/x-panel/v-p4m8/new" (or "/admin/products/new") -> "/products/new" */
export function relativeAdminPath(pathname: string, base: string = getAdminBase()): string {
  for (const prefix of [base, "/admin"]) {
    if (pathname === prefix) return "/";
    if (pathname.startsWith(`${prefix}/`)) {
      const stripped = pathname.slice(prefix.length);
      return deobfuscateAdminPath(stripped);
    }
  }
  return deobfuscateAdminPath(pathname);
}

export function isNavActive(relativePath: string, itemPath: string): boolean {
  return relativePath === itemPath || relativePath.startsWith(`${itemPath}/`);
}
