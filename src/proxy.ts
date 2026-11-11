import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkDoSProtection, getClientIp } from "@/lib/rate-limit";
import { verifySessionToken, verifyAmbassadorSessionToken } from "@/lib/server/security";

// Hidden admin routes. The public URL is /<ADMIN_PATH> for login and /<ADMIN_PATH>/* for dashboard pages.
// Direct visits to internal folders (/admin and /admin-login) fail closed and return 404.
const LOGIN_INTERNAL = "/admin-login";
const valid = /^[a-z0-9][a-z0-9-]{10,62}[a-z0-9]$/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request);

  // Check admin authentication session
  const sessionCookie = request.cookies.get("terra_admin_session")?.value;
  const isAuthedSession = verifySessionToken(sessionCookie).valid;

  // Check ambassador authentication session
  const ambSessionCookie = request.cookies.get("terra_amb_session")?.value;
  const isAmbSession = verifyAmbassadorSessionToken(ambSessionCookie).valid;

  // Exempt authenticated admins, ambassadors, internal Next.js assets, public media, and live SSE stream from aggressive DoS blocking
  const isExemptFromDos =
    isAuthedSession ||
    isAmbSession ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/media/") ||
    pathname.startsWith("/ambassador") ||
    pathname.startsWith("/api/ambassador") ||
    pathname === "/api/public/stream" ||
    request.nextUrl.searchParams.has("_rsc");

  // 1. DoS & Flooding Protection Check (for public unauthenticated traffic only):
  if (!isExemptFromDos) {
    const dosStatus = checkDoSProtection(ip);
    if (!dosStatus.allowed) {
      const retryAfter = dosStatus.retryAfterSeconds;

      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          {
            error: "IP_BLOCKED_TEMPORARILY",
            message:
              "تم حظر هذا العنوان مؤقتاً لحماية السيرفر من تكرار الطلبات المشبوهة.",
            retryAfter,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(retryAfter),
              "Content-Type": "application/json",
              "X-RateLimit-Limit": "150",
              "X-RateLimit-Remaining": "0",
            },
          }
        );
      }

      const htmlResponse = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>429 - تم الحظر مؤقتاً | TERRA HOP</title>
  <style>
    body {
      margin: 0; padding: 0;
      background-color: #0d0d0d; color: #f5f5f5;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; text-align: center;
    }
    .box {
      max-width: 480px; padding: 32px 24px;
      background: #171717; border: 1px solid #2e2e2e;
      border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .badge {
      display: inline-block; padding: 4px 12px;
      background: #c8102e; color: #fff; font-weight: bold;
      border-radius: 9999px; font-size: 12px; letter-spacing: 1px;
      margin-bottom: 16px;
    }
    <h1> { font-size: 24px; margin-bottom: 12px; font-weight: 800; }
    p { font-size: 14px; color: #a3a3a3; line-height: 1.6; margin-bottom: 20px; }
    .timer {
      font-family: monospace; font-size: 18px;
      background: #242424; padding: 10px; border-radius: 6px;
      border: 1px dashed #404040; color: #ffffff; margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="box">
    <div class="badge">حماية السيرفر (DOS PROTECTION)</div>
    <h1>تم حظر هذا العنوان مؤقتاً</h1>
    <p>تم رصد عدد طلبات متكرر بشكل غير طبيعي. حفاظاً على استقرار الخادم وسرعة المتجر، تم فرض حظر مؤقت.</p>
    <div class="timer">مدة الانتظار المتبقية: حوالي دقيقة واحدة</div>
    <p style="font-size: 12px; color: #737373;">TERRA HOP Security Engine &bull; Cloudflare Shield</p>
  </div>
</body>
</html>`;

      return new NextResponse(htmlResponse, {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }
  }

  // 2. Secret Admin Routing & IDOR / Access Control Protection
  const secret = (process.env.ADMIN_PATH ?? process.env.ADMIN_LOGIN_PATH ?? process.env.ADMIN_KEY ?? "").replace(/^\/+|\/+$/g, "");

  // Clean redirection for admin entry: /admin, /admin/, or /admin/login -> redirect to secret login URL
  if (pathname === "/admin" || pathname === "/admin/" || pathname === "/admin/login") {
    const target = valid.test(secret) ? `/${secret}` : LOGIN_INTERNAL;
    return NextResponse.redirect(new URL(target, request.url));
  }

  // Redirect /admin/<subpath> to /<secret>/<subpath> so direct bookmarks work seamlessly
  if (pathname.startsWith("/admin/") && valid.test(secret)) {
    const subpath = pathname.slice("/admin/".length);
    return NextResponse.redirect(new URL(`/${secret}/${subpath}`, request.url));
  }

  // Direct hits on internal login folder when not routed through secret URL
  if (pathname === LOGIN_INTERNAL || pathname.startsWith(`${LOGIN_INTERNAL}/`)) {
    return NextResponse.rewrite(new URL("/_not-found-hidden", request.url));
  }

  // Secret login URL: /<ADMIN_PATH> -> rewrites to /admin-login
  const requested = pathname.replace(/\/+$/, "").slice(1);
  if (valid.test(secret) && requested === secret) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    const res = NextResponse.rewrite(new URL(LOGIN_INTERNAL, request.url), {
      request: { headers: requestHeaders },
    });
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  }

  // Secret dashboard URLs: /<ADMIN_PATH>/<subpath> -> rewrites to /admin/<subpath>
  // IDOR & Authorization Shield: Block unauthenticated users from guessing order IDs (/orders/[id]) or products
  if (valid.test(secret) && pathname.startsWith(`/${secret}/`)) {
    if (!isAuthedSession) {
      return NextResponse.redirect(new URL(`/${secret}`, request.url));
    }
    const subpath = pathname.slice(secret.length + 2);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    const res = NextResponse.rewrite(new URL(`/admin/${subpath}`, request.url), {
      request: { headers: requestHeaders },
    });
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  }

  // 3. Ambassador Portal Disabled: redirect all /ambassador routes to home /
  if (pathname === "/ambassador" || pathname.startsWith("/ambassador/")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Ambassador API routes are also disabled
  if (pathname.startsWith("/api/ambassador")) {
    return NextResponse.json({ error: "DISABLED", message: "بوابة السفراء غير مفعّلة." }, { status: 404 });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  // Skip Next internals and any path with a file extension (images, fonts, icons).
  matcher: ["/((?!_next/|.*\\..*).*)"],
};
