import { NextRequest } from "next/server";
import {
  getDb,
  recordAudit,
  removeManagerFromEnv,
  updateEnvAdminPassword,
  updateEnvAdminEmail,
  syncManagerToEnv,
} from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { hashPassword, hashBlindIndex, encryptText, decryptText } from "@/lib/server/security";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { getClientIp } from "@/lib/rate-limit";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) {
    return auth.responseError!;
  }

  const { id } = await context.params;
  if (!id) {
    return apiError("VALIDATION", "معرّف المسؤول غير موجود.", 400);
  }

  const defaultAdminEmail = (process.env.ADMIN_EMAIL || "admin@terrahop.com").trim().toLowerCase();
  const isCurrentMaster =
    auth.user.role === "master" ||
    auth.user.id === "admin-root" ||
    (auth.user.username && auth.user.username.toLowerCase() === "admin") ||
    (auth.user.email && auth.user.email.toLowerCase() === defaultAdminEmail) ||
    (auth.user.email && auth.user.email.toLowerCase().includes("admin@"));

  // Authorization: Master admin can edit anyone; regular manager can ONLY edit their own profile
  const isSelf = auth.user.id === id || auth.user.email.toLowerCase() === id.toLowerCase();
  if (!isCurrentMaster && !isSelf) {
    return apiError("FORBIDDEN", "غير مصرح لك بتعديل بيانات هذا الحساب. يمكنك فقط تعديل حسابك الشخصي.", 403);
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION", "بيانات غير صالحة.", 400);
  }

  const db = getDb();
  let target = db
    .prepare("SELECT id, email, encrypted_email, username, encrypted_username, role, avatar_url, password_hash FROM admin_users WHERE id = ?")
    .get(id) as
    | {
        id: string;
        email: string;
        encrypted_email?: string;
        username?: string;
        encrypted_username?: string;
        role?: string;
        avatar_url?: string;
        password_hash: string;
      }
    | undefined;

  if (!target && (id === "admin-root" || id === "admin")) {
    target = db
      .prepare("SELECT id, email, encrypted_email, username, encrypted_username, role, avatar_url, password_hash FROM admin_users WHERE id = 'admin-root' OR LOWER(email) = ? LIMIT 1")
      .get(defaultAdminEmail) as any;
  }

  if (!target) {
    return apiError("NOT_FOUND", "المسؤول غير موجود في قاعدة البيانات.", 404);
  }

  const currentEmail = target.encrypted_email ? (decryptText(target.encrypted_email) || target.email) : target.email;
  const currentUsername = target.username || (target.encrypted_username ? decryptText(target.encrypted_username) : "admin");

  const newUsername = body.username !== undefined ? String(body.username).trim() : currentUsername;
  const newEmail = body.email !== undefined ? String(body.email).trim().toLowerCase() : currentEmail;
  const newPassword = body.password ? String(body.password) : null;
  const newAvatarUrl = body.avatarUrl !== undefined ? String(body.avatarUrl).trim() : (target.avatar_url || "");

  if (newUsername.length < 3) {
    return apiError("VALIDATION", "يجب ألا يقل اسم المستخدم عن 3 أحرف.", 400);
  }

  if (!newEmail || !newEmail.includes("@")) {
    return apiError("VALIDATION", "يرجى إدخال بريد إلكتروني صالح.", 400);
  }

  if (newPassword && newPassword.length < 8) {
    return apiError("VALIDATION", "يجب ألا تقل كلمة المرور عن 8 أحرف.", 400);
  }

  // Uniqueness check for email / username against other accounts
  const emailHash = hashBlindIndex(newEmail, "email");
  const usernameHash = hashBlindIndex(newUsername.toLowerCase(), "username");

  const conflict = db
    .prepare(`
      SELECT id FROM admin_users 
      WHERE id != ? 
        AND (email_hash = ? OR username_hash = ? OR LOWER(email) = ? OR LOWER(username) = ?)
      LIMIT 1
    `)
    .get(target.id, emailHash, usernameHash, newEmail, newUsername.toLowerCase());

  if (conflict) {
    return apiError("VALIDATION", "اسم المستخدم أو البريد الإلكتروني مسجل بالفعل لمسؤول آخر.", 409);
  }

  // Prepare updates
  const encryptedEmail = encryptText(newEmail);
  const encryptedUsername = encryptText(newUsername);
  let passwordHash = target.password_hash;

  const isTargetRoot = target.id === "admin-root" || target.role === "master";

  if (newPassword) {
    passwordHash = hashPassword(newPassword);
  }

  // Sync to .env
  if (isTargetRoot) {
    if (newEmail !== currentEmail) {
      updateEnvAdminEmail(newEmail);
    }
    if (newPassword) {
      updateEnvAdminPassword(newEmail, newPassword);
    }
  } else {
    syncManagerToEnv(newEmail, newUsername, passwordHash);
  }

  db.prepare(`
    UPDATE admin_users
    SET email = ?,
        email_hash = ?,
        encrypted_email = ?,
        username = ?,
        username_hash = ?,
        encrypted_username = ?,
        avatar_url = ?,
        password_hash = ?
    WHERE id = ?
  `).run(
    newEmail,
    emailHash,
    encryptedEmail,
    newUsername,
    usernameHash,
    encryptedUsername,
    newAvatarUrl || null,
    passwordHash,
    target.id
  );

  recordAudit({
    actor: auth.user.email,
    action: "UPDATE_MANAGER",
    entity: "admin_users",
    entityId: target.id,
    before: { email: currentEmail, username: currentUsername },
    after: { email: newEmail, username: newUsername, passwordChanged: !!newPassword },
    ip: getClientIp(request),
  });

  return apiSuccess({
    user: {
      id: target.id,
      email: newEmail,
      username: newUsername,
      role: target.role,
      avatarUrl: newAvatarUrl || null,
    },
    message: "تم تحديث بيانات المسؤول بنجاح.",
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

  // Only Master Admin can delete other managers
  if (!isCurrentMaster) {
    return apiError("FORBIDDEN", "غير مصرح لك بحذف مسؤولين. هذه الصلاحية للمسؤول الرئيسي فقط.", 403);
  }

  const { id } = await context.params;
  if (!id) {
    return apiError("VALIDATION", "معرّف المسؤول غير موجود.", 400);
  }

  // Prevent deleting root master admin or deleting oneself
  if (id === "admin-root" || id === auth.user.id) {
    return apiError("FORBIDDEN", "لا يمكن حذف حساب المسؤول الرئيسي.", 403);
  }

  const db = getDb();
  const target = db
    .prepare("SELECT id, email, username, role FROM admin_users WHERE id = ?")
    .get(id) as { id: string; email: string; username?: string; role?: string } | undefined;

  if (!target) {
    return apiError("NOT_FOUND", "المسؤول غير موجود.", 404);
  }

  if (target.role === "master") {
    return apiError("FORBIDDEN", "لا يمكن حذف حساب رئيسي آخر.", 403);
  }

  // Delete all sessions for this manager
  db.prepare("DELETE FROM admin_sessions WHERE user_id = ?").run(id);

  // Delete user record
  db.prepare("DELETE FROM admin_users WHERE id = ?").run(id);

  // Clean up env file credentials if stored
  try {
    if (target.username) {
      removeManagerFromEnv(target.username);
    }
  } catch (err) {
    console.error("Failed to remove manager from env:", err);
  }

  // Record action in Audit Log
  recordAudit({
    actor: auth.user.email,
    action: "DELETE_MANAGER",
    entity: "admin_users",
    entityId: id,
    before: { email: target.email, username: target.username },
    ip: getClientIp(request),
  });

  return apiSuccess({ deleted: true, id });
}
