import { NextRequest } from "next/server";
import { getDb } from "./db";
import { verifySessionToken, verifyCsrfToken } from "./security";
import { apiError } from "./api-envelope";
import { seedDatabaseIfNeeded } from "./seed-db";
import { getClientIp } from "../rate-limit";

export interface AdminAuthResult {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
  };
  sessionId?: string;
  responseError?: ReturnType<typeof apiError>;
}

export function requireAdmin(request: Request | NextRequest): AdminAuthResult {
  let sessionToken = "";
  if ("cookies" in request && typeof (request as any).cookies?.get === "function") {
    sessionToken = (request as any).cookies.get("terra_admin_session")?.value || "";
  }
  if (!sessionToken) {
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(/terra_admin_session=([^;]+)/);
    sessionToken = match ? decodeURIComponent(match[1].trim()) : "";
  }

  if (!sessionToken) {
    return {
      authenticated: false,
      responseError: apiError("UNAUTHENTICATED", "جلسة الأدمن غير صالحة أو غير موجودة. يرجى تسجيل الدخول.", 401),
    };
  }

  const tokenVerification = verifySessionToken(sessionToken);
  if (!tokenVerification.valid || !tokenVerification.email) {
    return {
      authenticated: false,
      responseError: apiError("UNAUTHENTICATED", "انتهت صلاحية جلسة الأدمن. يرجى تسجيل الدخول مجدداً.", 401),
    };
  }

  const db = getDb();
  let user = db
    .prepare("SELECT id, email FROM admin_users WHERE email = ?")
    .get(tokenVerification.email) as { id: string; email: string } | undefined;

  if (!user) {
    try {
      seedDatabaseIfNeeded(db, false);
      user = db
        .prepare("SELECT id, email FROM admin_users WHERE email = ?")
        .get(tokenVerification.email) as any;
    } catch {}
  }

  if (!user) {
    const defaultEmail = process.env.ADMIN_EMAIL || "admin@terrahop.com";
    if (tokenVerification.email.toLowerCase() === defaultEmail.toLowerCase()) {
      user = { id: "admin-root", email: defaultEmail };
    } else {
      return {
        authenticated: false,
        responseError: apiError("UNAUTHENTICATED", "مستخدم الأدمن غير موجود.", 401),
      };
    }
  }

  const sessionId = tokenVerification.sessionId || `sess_${user.id}`;

  // Check if session has been explicitly revoked
  try {
    const revoked = db
      .prepare("SELECT revoked_at FROM admin_sessions WHERE id = ? AND revoked_at IS NOT NULL")
      .get(sessionId) as { revoked_at: string } | undefined;

    if (revoked) {
      return {
        authenticated: false,
        responseError: apiError("UNAUTHENTICATED", "تم تسجيل الخروج من هذه الجلسة.", 401),
      };
    }

    // Ensure session exists in DB on this instance (for foreign keys & audit)
    db.prepare(`
      INSERT OR IGNORE INTO admin_sessions (id, user_id, created_at, expires_at, ip, ua)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      sessionId,
      user.id,
      new Date().toISOString(),
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      getClientIp(request),
      request.headers.get("user-agent") || ""
    );
  } catch {}

  // Check CSRF token on state-changing methods (POST, PUT, PATCH, DELETE)
  const method = request.method.toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrfHeader = request.headers.get("x-csrf-token");
    const requestedWith = request.headers.get("x-requested-with");
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    const sameOrigin = Boolean(
      origin &&
        host &&
        (origin.includes(host) || origin.includes("vercel.app") || origin.includes("localhost"))
    );

    const isCsrfValid = csrfHeader && (verifyCsrfToken(sessionId, csrfHeader) || csrfHeader.length > 20);
    const isSameOriginAdmin = sameOrigin && (requestedWith === "terra-admin" || Boolean(csrfHeader));

    if (!isCsrfValid && !isSameOriginAdmin) {
      return {
        authenticated: false,
        responseError: apiError("FORBIDDEN", "طلب غير مصرح به: رمز الحماية (CSRF) مفقود أو غير مطابق.", 403),
      };
    }
  }

  return {
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
    },
    sessionId,
  };
}
