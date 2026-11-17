import { NextRequest } from "next/server";
import crypto from "crypto";
import { getDb, recordAudit, syncManagerToEnv } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth-middleware";
import {
  hashPassword,
  hashBlindIndex,
  encryptText,
  decryptText,
} from "@/lib/server/security";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { getClientIp } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) {
    return auth.responseError!;
  }

  const db = getDb();
  const rows = db
    .prepare(`
      SELECT id, email, encrypted_email, username, encrypted_username, role, avatar_url, created_at
      FROM admin_users
      ORDER BY CASE WHEN id = 'admin-root' OR role = 'master' THEN 0 ELSE 1 END, created_at ASC
    `)
    .all() as Array<{
      id: string;
      email: string;
      encrypted_email?: string;
      username?: string;
      encrypted_username?: string;
      role?: string;
      avatar_url?: string;
      created_at: string;
    }>;

  const defaultAdminEmail = (process.env.ADMIN_EMAIL || "admin@terrahop.com").trim().toLowerCase();
  const isOnlyOne = rows.length <= 1;

  const managers = rows.map((r) => {
    const isRoot =
      r.id === "admin-root" ||
      r.role === "master" ||
      (r.username && r.username.toLowerCase() === "admin") ||
      (r.email && r.email.toLowerCase() === defaultAdminEmail) ||
      (r.email && r.email.toLowerCase().includes("admin@")) ||
      isOnlyOne;
    const decryptedEmail = r.encrypted_email ? decryptText(r.encrypted_email) || r.email : r.email;
    const decryptedUsername = r.username || (r.encrypted_username ? decryptText(r.encrypted_username) : "admin");
    return {
      id: r.id,
      email: decryptedEmail,
      username: decryptedUsername || "admin",
      role: isRoot ? "master" : r.role || "manager",
      avatarUrl: r.avatar_url || null,
      createdAt: r.created_at || new Date().toISOString(),
      isMaster: isRoot || r.role === "master",
    };
  });

  const isCurrentMaster =
    auth.user.role === "master" ||
    auth.user.id === "admin-root" ||
    (auth.user.username && auth.user.username.toLowerCase() === "admin") ||
    (auth.user.email && auth.user.email.toLowerCase() === defaultAdminEmail) ||
    (auth.user.email && auth.user.email.toLowerCase().includes("admin@")) ||
    isOnlyOne;

  return apiSuccess({
    managers,
    currentUserRole: isCurrentMaster ? "master" : "manager",
    isMaster: isCurrentMaster,
  });
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) {
    return auth.responseError!;
  }

  const defaultAdminEmail = (process.env.ADMIN_EMAIL || "admin@terrahop.com").trim().toLowerCase();
  const isCurrentMaster =
    auth.user.role === "master" ||
    auth.user.id === "admin-root" ||
    (auth.user.username && auth.user.username.toLowerCase() === "admin") ||
    (auth.user.email && auth.user.email.toLowerCase() === defaultAdminEmail) ||
    (auth.user.email && auth.user.email.toLowerCase().includes("admin@"));

  // Only the Master Admin is authorized to add other managers
  if (!isCurrentMaster) {
    return apiError("FORBIDDEN", "غير مصرح لك بإضافة مسؤولين. هذه الصلاحية للمسؤول الرئيسي فقط.", 403);
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION", "بيانات غير صالحة.", 400);
  }

  const username = (body.username || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const avatarUrl = (body.avatarUrl || "").trim();

  if (!username || username.length < 3) {
    return apiError("VALIDATION", "يجب ألا يقل اسم المستخدم عن 3 أحرف.", 400);
  }

  if (!email || !email.includes("@")) {
    return apiError("VALIDATION", "يرجى إدخال بريد إلكتروني صالح.", 400);
  }

  if (!password || password.length < 8) {
    return apiError("VALIDATION", "يجب ألا تقل كلمة المرور عن 8 أحرف.", 400);
  }

  const db = getDb();

  // Check if username or email already exists
  const emailHash = hashBlindIndex(email, "email");
  const usernameHash = hashBlindIndex(username.toLowerCase(), "username");

  const existing = db
    .prepare(`
      SELECT id FROM admin_users
      WHERE email_hash = ? OR username_hash = ? OR LOWER(email) = ? OR LOWER(username) = ?
      LIMIT 1
    `)
    .get(emailHash, usernameHash, email, username.toLowerCase());

  if (existing) {
    return apiError("VALIDATION", "البريد الإلكتروني أو اسم المستخدم مسجل بالفعل لمسؤول آخر.", 409);
  }

  // Strong cryptographic hash (Supabase bcrypt $2b$10$)
  const passwordHash = hashPassword(password);
  const encryptedEmail = encryptText(email);
  const encryptedUsername = encryptText(username);
  const newId = `mgr_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO admin_users (
      id, email, email_hash, encrypted_email, username, username_hash, encrypted_username,
      password_hash, role, avatar_url, must_change_password, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manager', ?, 0, ?)
  `).run(
    newId,
    email,
    emailHash,
    encryptedEmail,
    username,
    usernameHash,
    encryptedUsername,
    passwordHash,
    avatarUrl || null,
    now
  );

  // Sync encrypted credentials into .env files securely
  try {
    syncManagerToEnv(email, username, passwordHash);
  } catch (err) {
    console.error("Failed to sync manager to env:", err);
  }

  // Record in Audit Log
  recordAudit({
    actor: auth.user.email,
    action: "CREATE_MANAGER",
    entity: "admin_users",
    entityId: newId,
    after: { username, email, role: "manager" },
    ip: getClientIp(request),
  });

  return apiSuccess({
    manager: {
      id: newId,
      username,
      email,
      role: "manager",
      avatarUrl: avatarUrl || null,
      createdAt: now,
      isMaster: false,
    },
  });
}
