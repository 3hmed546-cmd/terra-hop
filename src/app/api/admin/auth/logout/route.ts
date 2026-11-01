import { NextRequest } from "next/server";
import { getDb, recordAudit } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { apiSuccess } from "@/lib/server/api-envelope";
import { getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  const db = getDb();
  const ip = getClientIp(request);

  if (auth.sessionId) {
    db.prepare(`
      UPDATE admin_sessions
      SET revoked_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), auth.sessionId);

    recordAudit({
      actor: auth.user?.email || "admin",
      action: "LOGOUT",
      entity: "admin_sessions",
      entityId: auth.sessionId,
      ip,
    });
  }

  const response = apiSuccess({ loggedOut: true });
  response.cookies.set("terra_admin_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
