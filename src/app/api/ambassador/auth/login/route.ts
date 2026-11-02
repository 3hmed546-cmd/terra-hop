import { NextRequest } from "next/server";
import crypto from "crypto";
import { getDb, recordAudit } from "@/lib/server/db";
import {
  verifyPassword,
  signAmbassadorSessionToken,
  hashLookupCode,
  decryptCode,
} from "@/lib/server/security";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rateLimitStatus = checkRateLimit(ip, {
    prefix: "amb_auth_login",
    max: 8,
    windowMs: 5 * 60 * 1000,
  });

  if (!rateLimitStatus.success) {
    return apiError(
      "RATE_LIMITED",
      "تم تجاوز الحد المسموح لمحاولات تسجيل الدخول. يرجى الانتظار قليلاً.",
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

  const rawInput = String(body.emailOrCode || body.email || body.code || "").trim();
  const password = String(body.password || "");

  if (!rawInput || !password) {
    return apiError("VALIDATION", "يرجى إدخال البريد الإلكتروني أو كود السفير وكلمة المرور.", 400);
  }

  const db = getDb();

  // 1. Try finding ambassador by email
  let userRow = db
    .prepare(`
      SELECT au.*, a.id as amb_id, a.display_name, a.status as amb_status
      FROM ambassador_users au
      JOIN ambassadors a ON au.ambassador_id = a.id
      WHERE LOWER(au.email) = ?
    `)
    .get(rawInput.toLowerCase()) as any;

  // 2. If not found by email, try finding by referral code
  if (!userRow) {
    const inputCodeHash = hashLookupCode(rawInput);
    const codeMatch = db
      .prepare(`
        SELECT rc.ambassador_id
        FROM referral_codes rc
        WHERE rc.code_hash = ?
      `)
      .get(inputCodeHash) as { ambassador_id: string } | undefined;

    if (codeMatch) {
      userRow = db
        .prepare(`
          SELECT au.*, a.id as amb_id, a.display_name, a.status as amb_status
          FROM ambassador_users au
          JOIN ambassadors a ON au.ambassador_id = a.id
          WHERE au.ambassador_id = ?
        `)
        .get(codeMatch.ambassador_id) as any;
    }
  }

  if (!userRow || !verifyPassword(password, userRow.password_hash)) {
    return apiError("UNAUTHENTICATED", "بيانات تسجيل الدخول غير صحيحة. يرجى التأكد من البريد أو الكود وكلمة المرور.", 401);
  }

  if (userRow.amb_status === "SUSPENDED") {
    return apiError("FORBIDDEN", "تم إيقاف حساب السفير مؤقتاً. يرجى التواصل مع إدارة TERRA HOP.", 403);
  }

  const sessionId = `amb_sess_${crypto.randomUUID()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  db.prepare(`
    INSERT INTO ambassador_sessions (id, ambassador_user_id, ambassador_id, created_at, expires_at, ip, ua)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    sessionId,
    userRow.id,
    userRow.amb_id,
    now.toISOString(),
    expiresAt.toISOString(),
    ip,
    request.headers.get("user-agent") || ""
  );

  // Update last login
  db.prepare("UPDATE ambassador_users SET last_login_at = ? WHERE id = ?").run(now.toISOString(), userRow.id);

  const token = signAmbassadorSessionToken(userRow.amb_id, userRow.email, sessionId);

  // Fetch active referral code
  const codeRow = db
    .prepare("SELECT encrypted_code, discount_percent FROM referral_codes WHERE ambassador_id = ? AND is_active = 1 LIMIT 1")
    .get(userRow.amb_id) as any;
  const activeCode = codeRow?.encrypted_code ? decryptCode(codeRow.encrypted_code) : "";

  const response = apiSuccess({
    ambassador: {
      id: userRow.amb_id,
      displayName: userRow.display_name,
      email: userRow.email,
      code: activeCode,
      discountPercent: codeRow?.discount_percent ?? 10,
    },
    message: "تم تسجيل الدخول بنجاح.",
  });

  // Set HTTP-Only session cookie
  response.cookies.set("terra_amb_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  // Set readable state cookie for instant client hydration
  response.cookies.set("terra_amb_logged_in", "1", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return response;
}
