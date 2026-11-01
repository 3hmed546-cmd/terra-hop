import { NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/server/security";

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/terra_admin_session=([^;]+)/);
  const token = match ? match[1] : "";
  const verification = verifySessionToken(token);

  if (!verification.valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ ok: true, accessToken: token });
}
