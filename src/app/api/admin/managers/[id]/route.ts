import { NextRequest } from "next/server";
import { getDb, recordAudit } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { getClientIp } from "@/lib/rate-limit";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) {
    return auth.responseError!;
  }

  // Only Master Admin can delete other managers
  if (auth.user.role !== "master") {
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
