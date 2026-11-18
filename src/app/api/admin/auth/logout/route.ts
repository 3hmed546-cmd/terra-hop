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

  const secret = (process.env.ADMIN_PATH || process.env.ADMIN_LOGIN_PATH || "k7q2-vault-9xm4").replace(/^\/+|\/+$/g, "");
  const loginUrl = `/${secret}`;

  const response = apiSuccess({ loggedOut: true, loginUrl });
  response.cookies.set("terra_admin_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set("terra_admin_logged_in", "", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
