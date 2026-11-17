import { NextRequest } from "next/server";
import { getDb, format12HourArabicTime } from "@/lib/server/db";
import { verifySessionToken } from "@/lib/server/security";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";

export async function GET(request: NextRequest) {
  let sessionToken = "";
  if ("cookies" in request && typeof (request as any).cookies?.get === "function") {
    sessionToken = (request as any).cookies.get("terra_admin_session")?.value || "";
  }
  if (!sessionToken) {
    const cookieHeader = request.headers.get("cookie") || "";
    const match = cookieHeader.match(/terra_admin_session=([^;]+)/);
    sessionToken = match ? decodeURIComponent(match[1].trim()) : "";
  }

  if (!sessionToken) {
    return apiSuccess({ active: false, unauthenticated: true });
  }

  const tokenVerification = verifySessionToken(sessionToken);
  if (!tokenVerification.valid || !tokenVerification.sessionId || !tokenVerification.email) {
    return apiSuccess({ active: false, unauthenticated: true });
  }

  const db = getDb();
  const session = db
    .prepare(`
      SELECT id, user_id, revoked_at, superseded_by, superseded_device, superseded_at
      FROM admin_sessions
      WHERE id = ?
    `)
    .get(tokenVerification.sessionId) as {
      id: string;
      user_id: string;
      revoked_at: string | null;
      superseded_by: string | null;
      superseded_device: string | null;
      superseded_at: string | null;
    } | undefined;

  // Session not found in DB
  if (!session) {
    return apiSuccess({ active: false, revoked: true });
  }

  // Session was superseded by a new login on another device
  if (session.superseded_by || session.superseded_at) {
    const { time12, dateFormatted } = format12HourArabicTime(session.superseded_at || new Date().toISOString());
    return apiSuccess({
      active: false,
      superseded: true,
      userEmail: tokenVerification.email,
      newDevice: {
        summary: session.superseded_device || "هاتف آخر",
        time: time12,
        date: dateFormatted,
      },
    });
  }

  // Session was manually revoked/logged out
  if (session.revoked_at) {
    return apiSuccess({ active: false, revoked: true });
  }

  // Also verify user's active_session_id in admin_users
  const user = db
    .prepare("SELECT active_session_id FROM admin_users WHERE id = ?")
    .get(session.user_id) as { active_session_id: string | null } | undefined;

  if (user && user.active_session_id && user.active_session_id !== session.id) {
    const { time12, dateFormatted } = format12HourArabicTime(new Date().toISOString());
    return apiSuccess({
      active: false,
      superseded: true,
      userEmail: tokenVerification.email,
      newDevice: {
        summary: session.superseded_device || "هاتف آخر",
        time: time12,
        date: dateFormatted,
      },
    });
  }

  return apiSuccess({ active: true, email: tokenVerification.email });
}
