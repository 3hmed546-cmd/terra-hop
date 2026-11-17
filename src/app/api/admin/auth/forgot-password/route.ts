import { NextRequest } from "next/server";
import crypto from "crypto";
import { getDb, recordAudit, recordChange, updateEnvAdminPassword } from "@/lib/server/db";
import { hashPassword, hashBlindIndex } from "@/lib/server/security";
import { sendBrevoEmail } from "@/lib/server/mailer";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { getClientIp } from "@/lib/rate-limit";

const SALT = process.env.ADMIN_SESSION_SECRET || "terra_otp_salt_secret_2026";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp + SALT).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return apiError("VALIDATION", "بيانات الطلب غير صالحة.", 400);
    }

    const action = body.action || "request_otp";
    const email = (body.email || "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return apiError("VALIDATION", "يرجى إدخال بريد إلكتروني صالح.", 400);
    }

    const db = getDb();
    const now = new Date();

    // -------------------------------------------------------------
    // 1. ACTION: REQUEST OTP
    // -------------------------------------------------------------
    if (action === "request_otp") {
      // Check for active 30-minute lockout on this email
      const activeLock = db
        .prepare(`
          SELECT locked_until 
          FROM admin_password_resets 
          WHERE email = ? AND locked_until IS NOT NULL 
          ORDER BY created_at DESC 
          LIMIT 1
        `)
        .get(email) as { locked_until: string } | undefined;

      if (activeLock && activeLock.locked_until) {
        const lockEnd = new Date(activeLock.locked_until);
        if (lockEnd.getTime() > now.getTime()) {
          const remainingMinutes = Math.ceil((lockEnd.getTime() - now.getTime()) / (60 * 1000));
          return apiError(
            "RATE_LIMITED",
            `تم حظر محاولات استعادة كلمة المرور لهذا الحساب مؤقتاً لمدة 30 دقيقة لتجاوز عدد المحاولات. متبقي ${remainingMinutes} دقيقة.`,
            429
          );
        }
      }

      // Verify that this email is an authorized admin/manager
      const emailBlindIndex = hashBlindIndex(email, "email");
      const defaultAdminEmail = (process.env.ADMIN_EMAIL || "admin@terrahop.com").trim().toLowerCase();

      const user = db
        .prepare(`
          SELECT id, email, username 
          FROM admin_users 
          WHERE email_hash = ? OR LOWER(email) = ? OR LOWER(email) = ?
          LIMIT 1
        `)
        .get(emailBlindIndex, email, defaultAdminEmail) as { id: string; email: string; username?: string } | undefined;

      if (!user) {
        // Record failed attempt for unknown email to protect against brute-force probing
        const resetId = `rst_${crypto.randomUUID().slice(0, 8)}`;
        db.prepare(`
          INSERT INTO admin_password_resets (id, email, otp_hash, attempts, expires_at, created_at)
          VALUES (?, ?, 'invalid', 1, ?, ?)
        `).run(resetId, email, new Date(now.getTime() + 15 * 60 * 1000).toISOString(), now.toISOString());

        return apiError("NOT_FOUND", "هذا البريد الإلكتروني غير مسجل كمسؤول في المتجر.", 404);
      }

      // Generate secure 6-digit numeric OTP
      const otp = String(crypto.randomInt(100000, 999999));
      const otpHash = hashOtp(otp);
      const resetId = `rst_${crypto.randomUUID().slice(0, 8)}`;
      const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString(); // 15 minutes validity

      // Invalidate previous unverified requests for this email
      db.prepare("DELETE FROM admin_password_resets WHERE email = ? AND used = 0").run(email);

      // Save encrypted/hashed OTP in DB
      db.prepare(`
        INSERT INTO admin_password_resets (id, email, otp_hash, attempts, expires_at, created_at)
        VALUES (?, ?, ?, 0, ?, ?)
      `).run(resetId, email, otpHash, expiresAt, now.toISOString());

      // Send OTP via Brevo API
      const recipientName = user.username || "مسؤول المتجر";
      const emailHtml = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f8; margin: 0; padding: 24px; color: #111; }
            .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e5e5e5; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
            .header { background: #080808; padding: 32px 24px; text-align: center; }
            .header h1 { color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 2px; font-weight: 900; }
            .header p { color: #a1a1aa; margin: 6px 0 0; font-size: 13px; }
            .content { padding: 32px 28px; text-align: center; }
            .otp-box { background: #f4f4f5; border: 2px dashed #080808; border-radius: 12px; padding: 18px 24px; margin: 24px auto; display: inline-block; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #080808; font-family: monospace; }
            .note { color: #52525b; font-size: 14px; line-height: 1.6; margin: 16px 0; }
            .warning { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 12px 16px; border-radius: 8px; font-size: 13px; margin-top: 24px; text-align: right; }
            .footer { padding: 20px 24px; background: #fafafa; border-top: 1px solid #f0f0f0; text-align: center; font-size: 12px; color: #71717a; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>TERRA HOP</h1>
              <p>لوحة التحكم الإدارية — استعادة كلمة المرور</p>
            </div>
            <div class="content">
              <h2 style="font-size: 18px; margin: 0 0 12px; color: #18181b;">مرحباً ${recipientName}،</h2>
              <p class="note">لقد تلقينا طلباً لاستعادة كلمة المرور الخاصة بحسابك في متجر <strong>TERRA HOP</strong>.<br>استخدم رمز التحقق (OTP) التالي لتأكيد هويتك وتعيين كلمة مرور جديدة:</p>
              
              <div class="otp-box">${otp}</div>
              
              <p class="note" style="font-size: 13px; color: #71717a;">⏱️ هذا الرمز صالح لمدة <strong>15 دقيقة فقط</strong> ولا يمكن استخدامه سوى مرة واحدة.</p>
              
              <div class="warning">
                ⚠️ <strong>تنبيه أمان:</strong> إذا لم تكن أنت من قام بهذا الطلب، يرجى تجاهل هذا البريد تماماً. لن يتمكن أحد من الدخول لحسابك دون هذا الرمز.
              </div>
            </div>
            <div class="footer">
              TERRA HOP TEAM &copy; 2026 — Higher On Purpose
            </div>
          </div>
        </body>
        </html>
      `;

      await sendBrevoEmail({
        to: email,
        recipientName,
        senderEmail: "support@terra-hop.com",
        senderName: "TERRA HOP",
        subject: "TERRA HOP — رمز استعادة كلمة المرور (OTP)",
        html: emailHtml,
      });

      return apiSuccess({
        message: "تم إرسال رمز التحقق (OTP) بنجاح إلى بريدك الإلكتروني.",
        expiresInMinutes: 15,
      });
    }

    // -------------------------------------------------------------
    // 2. ACTION: VERIFY OTP
    // -------------------------------------------------------------
    if (action === "verify_otp") {
      const otp = (body.otp || "").trim();
      if (!otp || otp.length !== 6) {
        return apiError("VALIDATION", "يرجى إدخال رمز التحقق المكون من 6 أرقام.", 400);
      }

      // Check current reset record
      const record = db
        .prepare(`
          SELECT id, otp_hash, attempts, locked_until, expires_at 
          FROM admin_password_resets 
          WHERE email = ? AND used = 0 
          ORDER BY created_at DESC 
          LIMIT 1
        `)
        .get(email) as {
          id: string;
          otp_hash: string;
          attempts: number;
          locked_until: string | null;
          expires_at: string;
        } | undefined;

      if (!record) {
        return apiError("NOT_FOUND", "لم يتم العثور على طلب استعادة نشط لهذا الإيميل. يرجى طلب رمز جديد.", 404);
      }

      // Check lockout
      if (record.locked_until) {
        const lockEnd = new Date(record.locked_until);
        if (lockEnd.getTime() > now.getTime()) {
          const remainingMinutes = Math.ceil((lockEnd.getTime() - now.getTime()) / (60 * 1000));
          return apiError(
            "RATE_LIMITED",
            `تم حظر هذا الحساب لمدة 30 دقيقة بسبب 5 محاولات خاطئة متتالية. متبقي ${remainingMinutes} دقيقة.`,
            429
          );
        }
      }

      // Check expiry
      if (new Date(record.expires_at).getTime() < now.getTime()) {
        return apiError("VALIDATION", "انتهت صلاحية رمز التحقق. يرجى طلب رمز جديد.", 400);
      }

      const inputHash = hashOtp(otp);
      if (inputHash !== record.otp_hash) {
        const newAttempts = (record.attempts || 0) + 1;
        if (newAttempts >= MAX_ATTEMPTS) {
          const lockedUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
          db.prepare("UPDATE admin_password_resets SET attempts = ?, locked_until = ? WHERE id = ?").run(
            newAttempts,
            lockedUntil,
            record.id
          );
          return apiError(
            "RATE_LIMITED",
            "تم استنفاد الحد الأقصى للمحاولات (5 محاولات خاطئة). تم حظر استعادة كلمة المرور لهذا الحساب لمدة 30 دقيقة لحمايته.",
            429
          );
        }

        db.prepare("UPDATE admin_password_resets SET attempts = ? WHERE id = ?").run(newAttempts, record.id);
        const remaining = MAX_ATTEMPTS - newAttempts;
        return apiError("VALIDATION", `رمز التحقق (OTP) غير صحيح. متبقي لك ${remaining} محاولات قبل الحظر.`, 400);
      }

      // Correct OTP! Generate Reset Token
      const resetToken = crypto.randomUUID();
      db.prepare("UPDATE admin_password_resets SET reset_token = ?, attempts = 0 WHERE id = ?").run(
        resetToken,
        record.id
      );

      return apiSuccess({
        verified: true,
        resetToken,
        message: "تم التحقق من الرمز بنجاح. يمكنك الآن تعيين كلمة مرور جديدة.",
      });
    }

    // -------------------------------------------------------------
    // 3. ACTION: RESET PASSWORD
    // -------------------------------------------------------------
    if (action === "reset_password") {
      const resetToken = (body.resetToken || "").trim();
      const newPassword = body.newPassword || "";

      if (!resetToken) {
        return apiError("VALIDATION", "جلسة استعادة كلمة المرور غير صالحة.", 400);
      }

      if (!newPassword || newPassword.length < 8) {
        return apiError("VALIDATION", "يجب ألا تقل كلمة المرور الجديدة عن 8 أحرف.", 400);
      }

      const record = db
        .prepare(`
          SELECT id, email, expires_at 
          FROM admin_password_resets 
          WHERE email = ? AND reset_token = ? AND used = 0 
          ORDER BY created_at DESC 
          LIMIT 1
        `)
        .get(email, resetToken) as { id: string; email: string; expires_at: string } | undefined;

      if (!record) {
        return apiError("VALIDATION", "رمز استعادة كلمة المرور غير صالح أو تم استخدامه مسبقاً.", 400);
      }

      if (new Date(record.expires_at).getTime() < now.getTime()) {
        return apiError("VALIDATION", "انتهت صلاحية جلسة الاستعادة. يرجى طلب رمز جديد.", 400);
      }

      // Strong Supabase Bcrypt hash ($2b$10$)
      const newHash = hashPassword(newPassword);

      // Find target user in admin_users
      const defaultAdminEmail = (process.env.ADMIN_EMAIL || "admin@terrahop.com").trim().toLowerCase();
      const emailBlindIndex = hashBlindIndex(email, "email");

      const user = db
        .prepare(`
          SELECT id, email 
          FROM admin_users 
          WHERE email_hash = ? OR LOWER(email) = ? OR LOWER(email) = ?
          LIMIT 1
        `)
        .get(emailBlindIndex, email, defaultAdminEmail) as { id: string; email: string } | undefined;

      if (!user) {
        return apiError("NOT_FOUND", "المسؤول غير موجود في قاعدة البيانات.", 404);
      }

      // Update password hash in database
      db.prepare(`
        UPDATE admin_users
        SET password_hash = ?, must_change_password = 0
        WHERE id = ?
      `).run(newHash, user.id);

      // If master root admin, update .env.local as requested
      if (user.id === "admin-root" || email.toLowerCase() === defaultAdminEmail) {
        updateEnvAdminPassword(email, newPassword);
      }

      // Mark reset record as used
      db.prepare("UPDATE admin_password_resets SET used = 1 WHERE id = ?").run(record.id);

      // Invalidate all active sessions for this user across all devices immediately
      db.prepare(`
        UPDATE admin_sessions 
        SET revoked_at = ?,
            superseded_device = 'تم إنهاء الجلسات بسبب تغيير كلمة المرور'
        WHERE user_id = ?
      `).run(now.toISOString(), user.id);

      db.prepare("UPDATE admin_users SET active_session_id = NULL WHERE id = ?").run(user.id);

      // Trigger instant SSE kick-out event to all open devices
      recordChange("auth", "session_superseded", user.id, Date.now());

      // Record in Audit Log
      recordAudit({
        actor: email,
        action: "RESET_PASSWORD",
        entity: "admin_users",
        entityId: user.id,
        ip,
      });

      return apiSuccess({
        success: true,
        message: "تم تحديث كلمة المرور وتسجيل الخروج من كافة الأجهزة بنجاح! يمكنك الآن تسجيل الدخول.",
      });
    }

    return apiError("VALIDATION", "إجراء غير معروف.", 400);
  } catch (err: any) {
    console.error("Forgot password route error:", err);
    return apiError("INTERNAL_ERROR", "حدث خطأ أثناء معالجة الطلب. يرجى المحاولة لاحقاً.", 500);
  }
}
