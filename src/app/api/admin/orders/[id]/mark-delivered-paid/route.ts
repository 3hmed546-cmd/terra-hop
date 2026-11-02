import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb } from "@/lib/server/db";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { markOrderDeliveredAndPaid } from "@/lib/server/ambassadors/qualification";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  const { id } = await context.params;
  const db = getDb();

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // optional body
  }

  try {
    const result = markOrderDeliveredAndPaid(
      db,
      id,
      auth.user.email,
      body.courierReference
    );

    return apiSuccess(result);
  } catch (err: any) {
    return apiError("VALIDATION", err.message || "فشل تأكيد التسليم والتحصيل.", 400);
  }
}
