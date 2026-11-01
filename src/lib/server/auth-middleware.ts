import { NextRequest } from "next/server";
import { getDb } from "./db";
import { verifySessionToken, verifyCsrfToken } from "./security";
import { apiError } from "./api-envelope";

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
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/terra_admin_session=([^;]+)/);
  const sessionToken = match ? match[1].trim() : "";

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
  // Verify session in database (admin_sessions)
  const sessionRecord = db
    .prepare(`
      SELECT s.id as session_id, s.expires_at, s.revoked_at, u.id as user_id, u.email
      FROM admin_sessions s
      JOIN admin_users u ON s.user_id = u.id
      WHERE u.email = ? AND s.revoked_at IS NULL
      ORDER BY s.created_at DESC
      LIMIT 1
    `)
    .get(tokenVerification.email) as
    | {
        session_id: string;
        expires_at: string;
        revoked_at: string | null;
        user_id: string;
        email: string;
      }
    | undefined;

  if (!sessionRecord) {
    return {
      authenticated: false,
      responseError: apiError("UNAUTHENTICATED", "الجلسة ملغاة أو غير موجودة في قاعدة البيانات.", 401),
    };
  }

  if (new Date(sessionRecord.expires_at).getTime() < Date.now()) {
    return {
      authenticated: false,
      responseError: apiError("UNAUTHENTICATED", "انتهت مهلة الجلسة. يرجى تسجيل الدخول مجدداً.", 401),
    };
  }

  // Check CSRF token on state-changing methods (POST, PUT, PATCH, DELETE)
  const method = request.method.toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrfHeader = request.headers.get("x-csrf-token");
    if (!csrfHeader || !verifyCsrfToken(sessionRecord.session_id, csrfHeader)) {
      // Also allow origin check as double defense
      const origin = request.headers.get("origin");
      const host = request.headers.get("host");
      const sameOrigin = origin && host && origin.includes(host);
      
      // If CSRF header fails and not clearly same-origin with custom header
      if (!csrfHeader && !sameOrigin) {
        return {
          authenticated: false,
          responseError: apiError("FORBIDDEN", "طلب غير مصرح به: رمز الحماية (CSRF) مفقود أو غير مطابق.", 403),
        };
      }
    }
  }

  return {
    authenticated: true,
    user: {
      id: sessionRecord.user_id,
      email: sessionRecord.email,
    },
    sessionId: sessionRecord.session_id,
  };
}
