import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb, recordAudit } from "@/lib/server/db";
import { verifyPassword, signSessionToken, generateCsrfToken } from "@/lib/server/security";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { seedDatabaseIfNeeded } from "@/lib/server/seed-db";
import {
  getClientIp,
  checkLoginRateLimit,
  recordFailedLoginAttempt,
  recordSuccessfulLogin,
} from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    // 1. Check if IP is currently under 20-minute lockout (triggered after 8 failed attempts)
    const bruteForceCheck = checkLoginRateLimit(ip);
    if (!bruteForceCheck.allowed) {
      return apiError(
        "RATE_LIMITED",
        bruteForceCheck.message || "تم حظر محاولات تسجيل الدخول لهذا العنوان مؤقتاً لمدة 20 دقيقة.",
        429,
        null,
        { "Retry-After": String(bruteForceCheck.retryAfterSeconds) }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return apiError("VALIDATION", "بيانات تسجيل الدخول غير صالحة.", 400);
    }

    let email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
      return apiError("VALIDATION", "يرجى إدخال البريد الإلكتروني وكلمة المرور.", 400);
    }

    // Allow typing "admin" shorthand for the primary admin email
    const configuredAdminEmail = (process.env.ADMIN_EMAIL || "admin@terrahop.com").trim().toLowerCase();
    if (email === "admin" || !email.includes("@")) {
      email = configuredAdminEmail;
    }

    const db = getDb();
    let user = db
      .prepare("SELECT id, email, password_hash, must_change_password FROM admin_users WHERE LOWER(email) = ?")
      .get(email) as
      | { id: string; email: string; password_hash: string; must_change_password: number }
      | undefined;

    if (!user) {
      // If root admin not found by custom email, check default admin
      user = db
        .prepare("SELECT id, email, password_hash, must_change_password FROM admin_users WHERE id = 'admin-root'")
        .get() as any;
    }

    // Verify scrypt cryptographic password hash
    if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
      const fail = recordFailedLoginAttempt(ip);
      if (fail.isLockedOut) {
        return apiError(
          "RATE_LIMITED",
          fail.message,
          429,
          null,
          { "Retry-After": String(fail.retryAfterSeconds) }
        );
      }
      return apiError("UNAUTHENTICATED", fail.message, 401);
    }

    // On Successful Authentication: Reset failed login records immediately
    recordSuccessfulLogin(ip);

    // Create database session
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    const userAgent = request.headers.get("user-agent") || "";

    db.prepare(`
      INSERT INTO admin_sessions (id, user_id, created_at, expires_at, ip, ua)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, user.id, now.toISOString(), expiresAt.toISOString(), ip, userAgent);

    recordAudit({
      actor: email,
      action: "LOGIN",
      entity: "admin_sessions",
      entityId: sessionId,
      ip,
    });

    const sessionToken = signSessionToken(email, sessionId);
    const csrfToken = generateCsrfToken(sessionId);

    const response = apiSuccess({
      user: {
        id: user.id,
        email: user.email,
      },
      csrfToken,
      mustChangePassword: user.must_change_password === 1,
    });

    // Set HttpOnly, Secure, SameSite Cookie
    response.cookies.set("terra_admin_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60,
    });

    response.cookies.set("terra_admin_logged_in", "1", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60,
    });

    response.headers.set("X-CSRF-Token", csrfToken);

    return response;
  } catch (error: any) {
    console.error("Login route error:", error);
    return apiError("INTERNAL_ERROR", "حدث خطأ داخلي في الخادم. يرجى المحاولة لاحقاً.", 500);
  }
}
