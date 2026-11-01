import { NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/server/security";
import { getOrdersFromVault, updateOrderStatusInVault } from "@/lib/server/vault";
import { sanitizeText } from "@/lib/sanitize";

function authenticateAdmin(request: Request): boolean {
  // Check HttpOnly session cookie
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/terra_admin_session=([^;]+)/);
  const cookieToken = match ? match[1] : "";
  if (verifySessionToken(cookieToken).valid) return true;

  // Check Authorization Bearer header
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7).trim();
    if (verifySessionToken(bearerToken).valid) return true;
  }

  return false;
}

// GET /api/admin/orders - Decrypts and returns all orders from the secure server vault
export async function GET(request: Request) {
  if (!authenticateAdmin(request)) {
    return NextResponse.json({ error: "غير مصرح لك بالوصول (Unauthorized)" }, { status: 401 });
  }

  try {
    const orders = await getOrdersFromVault();
    return NextResponse.json({ ok: true, orders }, { status: 200 });
  } catch (err) {
    console.error("[Vault Retrieval Error]", err);
    return NextResponse.json({ error: "فشل استرجاع بيانات الخزنة المشفرة" }, { status: 500 });
  }
}

// PATCH /api/admin/orders - Updates order status in the secure server vault
export async function PATCH(request: Request) {
  if (!authenticateAdmin(request)) {
    return NextResponse.json({ error: "غير مصرح لك بالوصول (Unauthorized)" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const orderId = sanitizeText(String(body.orderId || ""));
    const status = sanitizeText(String(body.status || ""));

    if (!orderId || !status) {
      return NextResponse.json({ error: "البيانات غير مكتملة" }, { status: 400 });
    }

    const validStatuses = ["AWAITING_APPROVAL", "SOLD", "CANCELLED", "PENDING_EMAIL"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "حالة الطلب غير صالحة" }, { status: 400 });
    }

    const updated = await updateOrderStatusInVault(orderId, status as any);
    if (!updated) {
      return NextResponse.json({ error: "الطلب غير موجود في الخزنة" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, message: "تم تحديث حالة الطلب في الخزنة بنجاح" }, { status: 200 });
  } catch (err) {
    console.error("[Vault Update Error]", err);
    return NextResponse.json({ error: "فشل تحديث الطلب" }, { status: 500 });
  }
}
