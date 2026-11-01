import { NextRequest } from "next/server";
import { getDb, recordAudit } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { verifyPassword, hashPassword } from "@/lib/server/security";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) {
    return auth.responseError!;
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION", "بيانات تغيير كلمة المرور غير صالحة.", 400);
  }

  const currentPassword = body.currentPassword || "";
  const newPassword = body.newPassword || "";

  if (!currentPassword || !newPassword) {
    return apiError("VALIDATION", "يرجى إدخال كلمة المرور الحالية وكلمة المرور الجديدة.", 400);
  }

  if (newPassword.length < 8) {
    return apiError("VALIDATION", "يجب ألا تقل كلمة المرور الجديدة عن 8 أحرف.", 400);
  }

  const db = getDb();
  const user = db
    .prepare("SELECT password_hash FROM admin_users WHERE id = ?")
    .get(auth.user.id) as { password_hash: string } | undefined;

  if (!user || !verifyPassword(currentPassword, user.password_hash)) {
    return apiError("VALIDATION", "كلمة المرور الحالية غير صحيحة.", 400);
  }

  const newHash = hashPassword(newPassword);
  db.prepare(`
    UPDATE admin_users
    SET password_hash = ?, must_change_password = 0
    WHERE id = ?
  `).run(newHash, auth.user.id);

  // Revoke other sessions
  if (auth.sessionId) {
    db.prepare(`
      UPDATE admin_sessions
      SET revoked_at = ?
      WHERE user_id = ? AND id != ?
    `).run(new Date().toISOString(), auth.user.id, auth.sessionId);
  }

  recordAudit({
    actor: auth.user.email,
    action: "CHANGE_PASSWORD",
    entity: "admin_users",
    entityId: auth.user.id,
    ip: getClientIp(request),
  });

  return apiSuccess({ updated: true });
}
