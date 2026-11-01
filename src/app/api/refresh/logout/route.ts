import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: "terra_admin_session",
    value: "",
    path: "/",
    maxAge: 0,
  });
  return response;
}
