// Input sanitization and security helpers (Cloudflare Security Guidelines)

export function sanitizeText(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .trim();
}

export function verifySameOrigin(request: Request): boolean {
  // Allow all requests in development
  if (process.env.NODE_ENV !== "production") return true;

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) return true; // Non-browser clients or direct API tools

  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}
