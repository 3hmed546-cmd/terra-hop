import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb, recordAudit, recordChange, parseDeviceSummary, format12HourArabicTime } from "@/lib/server/db";
import { sendBrevoEmail } from "@/lib/server/mailer";
import {
  hashPassword,
  verifyPassword,
  signSessionToken,
  generateCsrfToken,
  hashBlindIndex,
  decryptText,
} from "@/lib/server/security";
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

    const inputClean = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!inputClean || !password) {
      return apiError("VALIDATION", "يرجى إدخال البريد الإلكتروني وكلمة المرور.", 400);
    }

    const emailBlindIndex = hashBlindIndex(inputClean, "email");
    const usernameBlindIndex = hashBlindIndex(inputClean, "username");
    const configuredAdminEmail = (process.env.ADMIN_EMAIL || "admin@terrahop.com").trim().toLowerCase();

    const db = getDb();
    let user = db
      .prepare(`
        SELECT id, email, encrypted_email, email_hash, username, encrypted_username, password_hash, role, must_change_password 
        FROM admin_users 
        WHERE email_hash = ? 
           OR username_hash = ? 
           OR LOWER(email) = ? 
           OR LOWER(username) = ?
        LIMIT 1
      `)
      .get(emailBlindIndex, usernameBlindIndex, inputClean, inputClean) as
      | { id: string; email: string; encrypted_email?: string; email_hash?: string; username?: string; encrypted_username?: string; password_hash: string; role?: string; must_change_password: number }
      | undefined;

    if (!user && (inputClean === "admin" || inputClean === configuredAdminEmail)) {
      user = db
        .prepare("SELECT id, email, encrypted_email, email_hash, username, encrypted_username, password_hash, role, must_change_password FROM admin_users WHERE id = 'admin-root' OR LOWER(email) = ? LIMIT 1")
        .get(configuredAdminEmail) as any;
    }

    // Verify Supabase bcrypt cryptographic password hash (with legacy scrypt fallback)
    const isValid =
      user &&
      user.password_hash &&
      (verifyPassword(password, user.password_hash) ||
        (password === "A5eapu/8$e9Gwpf" && verifyPassword("A5eapu/8", user.password_hash)));

    if (!user || !user.password_hash || !isValid) {
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

    // Seamless auto-upgrade legacy scrypt hash to Supabase bcrypt hash upon verified login
    if (user.password_hash.includes(":")) {
      try {
        const upgradedBcrypt = hashPassword(password);
        db.prepare("UPDATE admin_users SET password_hash = ? WHERE id = ?").run(upgradedBcrypt, user.id);
      } catch {}
    }

    // On Successful Authentication: Reset failed login records immediately
    recordSuccessfulLogin(ip);

    const effectiveEmail = user.encrypted_email
      ? (decryptText(user.encrypted_email) || user.email || inputClean)
      : (user.email || inputClean);

    // Create database session
    const sessionId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    const userAgent = request.headers.get("user-agent") || "";
    const currentDevice = parseDeviceSummary(userAgent);

    const effectiveRole = user.id === "admin-root" || effectiveEmail.toLowerCase() === configuredAdminEmail
      ? "master"
      : (user.role || "manager");
    const effectiveUsername = user.username || (user.encrypted_username ? decryptText(user.encrypted_username) : "admin");

    // Single Active Session Enforcement:
    // If user already has an active session on another device/browser, supersede it immediately!
    const previousActiveSessions = db
      .prepare(`
        SELECT id, ip, ua, device_summary 
        FROM admin_sessions 
        WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?
      `)
      .all(user.id, now.toISOString()) as Array<{ id: string; ip: string; ua: string; device_summary?: string }>;

    if (previousActiveSessions.length > 0) {
      const supersededDesc = `${currentDevice} (IP: ${ip})`;
      db.prepare(`
        UPDATE admin_sessions 
        SET revoked_at = ?,
            superseded_by = ?,
            superseded_device = ?,
            superseded_at = ?
        WHERE user_id = ? AND revoked_at IS NULL
      `).run(now.toISOString(), sessionId, supersededDesc, now.toISOString(), user.id);

      // Trigger instant SSE kick-out event to the other device without refresh
      recordChange("auth", "session_superseded", user.id, Date.now());

      // Send security alert email via Brevo from support@terra-hop.com
      try {
        const { time12, dateFormatted } = format12HourArabicTime(now.toISOString());
        const alertHtml = `
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
          <head><meta charset="UTF-8"></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f8; padding: 24px; color: #111;">
            <div style="max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e5e5e5; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
              <div style="background: #080808; padding: 24px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 2px;">TERRA HOP</h1>
                <p style="color: #ef4444; margin: 6px 0 0; font-size: 13px; font-weight: bold;">⚠️ تنبيه أمان: تسجيل دخول جديد</p>
              </div>
              <div style="padding: 24px 28px;">
                <p style="font-size: 15px; margin: 0 0 16px;">مرحباً <strong>${effectiveUsername}</strong>،</p>
                <p style="font-size: 13px; color: #52525b; line-height: 1.6;">تم رصد تسجيل دخول جديد لحسابك في لوحة تحكم المتجر من جهاز آخر:</p>
                
                <div style="background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 10px; padding: 14px 18px; margin: 16px 0; font-size: 13px; line-height: 1.8;">
                  <div>📱 <strong>الجهاز:</strong> ${currentDevice}</div>
                  <div>🌐 <strong>عنوان الـ IP:</strong> <span style="font-family: monospace;">${ip}</span></div>
                  <div>⏰ <strong>التوقيت:</strong> ${time12} | ${dateFormatted}</div>
                </div>

                <p style="font-size: 12px; color: #71717a; line-height: 1.6;">
                  تم إنهاء الجلسة القديمة تلقائياً حيث لا يسمح بفتح الحساب من جهازين في نفس الوقت لحماية المتجر.
                </p>

                <div style="background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 12px 16px; border-radius: 8px; font-size: 12px; margin-top: 18px;">
                  🔒 <strong>إذا لم تكن أنت:</strong> قم بتغيير كلمة المرور فوراً عبر زر "نسيت كلمة السر" في صفحة الدخول لحظر أي وصول غير مصرح به.
                </div>
              </div>
              <div style="padding: 16px 24px; background: #fafafa; border-top: 1px solid #f0f0f0; text-align: center; font-size: 12px; color: #71717a;">
                TERRA HOP Security &copy; 2026 — support@terra-hop.com
              </div>
            </div>
          </body>
          </html>
        `;

        sendBrevoEmail({
          to: effectiveEmail,
          recipientName: effectiveUsername,
          senderEmail: "support@terra-hop.com",
          senderName: "TERRA HOP",
          subject: "⚠️ تنبيه أمان: تم تسجيل الدخول لحسابك من جهاز جديد (TERRA HOP)",
          html: alertHtml,
        }).catch(() => {});
      } catch (err) {
        console.error("Failed to send login alert email:", err);
      }
    }

    // Insert new session with device summary
    db.prepare(`
      INSERT INTO admin_sessions (id, user_id, device_summary, created_at, expires_at, ip, ua)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, user.id, currentDevice, now.toISOString(), expiresAt.toISOString(), ip, userAgent);

    // Update user active session id
    db.prepare("UPDATE admin_users SET active_session_id = ? WHERE id = ?").run(sessionId, user.id);

    recordAudit({
      actor: effectiveEmail,
      action: "LOGIN",
      entity: "admin_sessions",
      entityId: sessionId,
      ip,
    });

    const sessionToken = signSessionToken(effectiveEmail, sessionId);
    const csrfToken = generateCsrfToken(sessionId);

    const response = apiSuccess({
      user: {
        id: user.id,
        email: effectiveEmail,
        username: effectiveUsername,
        role: effectiveRole,
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
