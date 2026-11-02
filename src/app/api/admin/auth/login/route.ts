import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb, recordAudit } from "@/lib/server/db";
import { verifyPassword, signSessionToken, generateCsrfToken } from "@/lib/server/security";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { seedDatabaseIfNeeded } from "@/lib/server/seed-db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Ensure database has been seeded with initial admin if needed
    seedDatabaseIfNeeded();

    const ip = getClientIp(request);
    const rateLimitStatus = checkRateLimit(ip, { prefix: "login", max: 5, windowMs: 60 * 1000 });
    if (!rateLimitStatus.success) {
      return apiError(
        "RATE_LIMITED",
        "تم تجاوز الحد الأقصى لمحاولات الدخول. يرجى الانتظار دقيقة والمحاولة مجدداً.",
        429,
        null,
        { "Retry-After": String(rateLimitStatus.retryAfter) }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return apiError("VALIDATION", "بيانات تسجيل الدخول غير صالحة.", 400);
    }

    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
      return apiError("VALIDATION", "يرجى إدخال البريد الإلكتروني وكلمة المرور.", 400);
    }

    const db = getDb();
    const user = db
      .prepare("SELECT id, email, password_hash, must_change_password FROM admin_users WHERE email = ?")
      .get(email) as
      | { id: string; email: string; password_hash: string; must_change_password: number }
      | undefined;

    if (!user || !verifyPassword(password, user.password_hash)) {
      return apiError("UNAUTHENTICATED", "البريد الإلكتروني أو كلمة المرور غير صحيحة.", 401);
    }

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

    response.headers.set("X-CSRF-Token", csrfToken);

    return response;
  } catch (error: any) {
    console.error("Login route error:", error);
    return apiError("INTERNAL_ERROR", "حدث خطأ داخلي في الخادم. يرجى المحاولة لاحقاً.", 500);
  }
}
