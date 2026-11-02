import { NextResponse } from "next/server";
import { apiSuccess } from "@/lib/server/api-envelope";

export async function POST() {
  const response = apiSuccess({ ok: true, message: "تم تسجيل الخروج بنجاح." });

  response.cookies.delete("terra_amb_session");
  response.cookies.delete("terra_amb_logged_in");

  return response;
}
