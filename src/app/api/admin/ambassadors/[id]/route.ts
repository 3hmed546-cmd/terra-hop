import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb, recordAudit, recordChange } from "@/lib/server/db";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { decryptCode } from "@/lib/server/security";
import { getAmbassadorRewards } from "@/lib/server/ambassadors/rewards";
import { decryptCustomer } from "@/lib/server/vault";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  const { id } = await context.params;
  const db = getDb();

  const ambassador = db
    .prepare(`
      SELECT 
        a.*,
        ap.qualified_count,
        ap.net_count,
        ap.pending_count,
        ap.cancelled_count,
        ap.first_qualified_at,
        al.name as level_name,
        al.rank as level_rank
      FROM ambassadors a
      LEFT JOIN ambassador_progress ap ON a.id = ap.ambassador_id
      LEFT JOIN ambassador_levels al ON ap.current_level_id = al.id
      WHERE a.id = ?
    `)
    .get(id) as any;

  if (!ambassador) {
    return apiError("NOT_FOUND", "السفير غير موجود.", 404);
  }

  // Codes
  const codeRows = db
    .prepare("SELECT * FROM referral_codes WHERE ambassador_id = ? ORDER BY created_at DESC")
    .all(id) as any[];

  const codes = codeRows.map((r) => {
    const scopedProducts =
      r.applies_to === "SELECTED"
        ? (db
            .prepare(
              "SELECT p.id, p.name_ar, p.slug FROM discount_code_products dcp JOIN products p ON dcp.product_id = p.id WHERE dcp.code_id = ?"
            )
            .all(r.id) as any[])
        : [];

    return {
      id: r.id,
      code: decryptCode(r.encrypted_code),
      discountPercent: r.discount_percent,
      appliesTo: r.applies_to,
      maxUses: r.max_uses ?? null,
      isActive: r.is_active === 1,
      usedCount: r.used_count,
      createdAt: r.created_at,
      products: scopedProducts,
    };
  });

  // Milestones
  const milestones = db
    .prepare("SELECT * FROM ambassador_milestones WHERE ambassador_id = ? ORDER BY occurred_at DESC")
    .all(id) as any[];

  // Rewards
  const rewards = getAmbassadorRewards(db, id);

  // Attributed Orders
  const orderRows = db
    .prepare(`
      SELECT 
        id, number, status, fulfilment_status, payment_status,
        subtotal_cents, shipping_cents, discount_cents, total_cents,
        customer_enc, created_at, delivered_at
      FROM orders
      WHERE ambassador_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `)
    .all(id) as any[];

  const orders = orderRows.map((o) => {
    let customerName = "عميل";
    try {
      const cust = decryptCustomer(o.customer_enc);
      customerName = cust.name;
    } catch {}

    return {
      id: o.id,
      number: o.number,
      status: o.status,
      fulfilmentStatus: o.fulfilment_status || "NOT_SHIPPED",
      paymentStatus: o.payment_status || "UNPAID",
      totalCents: o.total_cents,
      total: Math.round((o.total_cents || 0) / 100),
      discountCents: o.discount_cents,
      customerName,
      createdAt: o.created_at,
      deliveredAt: o.delivered_at,
    };
  });

  return apiSuccess({
    ambassador: {
      id: ambassador.id,
      displayName: ambassador.display_name,
      fullName: ambassador.full_name,
      phone: ambassador.phone,
      email: ambassador.email,
      instagramHandle: ambassador.instagram_handle,
      city: ambassador.city,
      notes: ambassador.notes,
      status: ambassador.status,
      suspendedReason: ambassador.suspended_reason,
      joinedAt: ambassador.joined_at,
      netSales: ambassador.net_count ?? 0,
      pendingSales: ambassador.pending_count ?? 0,
      levelName: ambassador.level_name || "Starter",
      levelRank: ambassador.level_rank || 1,
      firstQualifiedAt: ambassador.first_qualified_at,
    },
    codes,
    milestones,
    rewards,
    orders,
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  const { id } = await context.params;
  const db = getDb();

  const ambassador = db.prepare("SELECT * FROM ambassadors WHERE id = ?").get(id) as any;
  if (!ambassador) {
    return apiError("NOT_FOUND", "السفير غير موجود.", 404);
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION", "بيانات غير صالحة.", 400);
  }

  const displayName = body.displayName !== undefined ? String(body.displayName).trim() : ambassador.display_name;
  const fullName = body.fullName !== undefined ? String(body.fullName).trim() : ambassador.full_name;
  const instagramHandle = body.instagramHandle !== undefined ? (String(body.instagramHandle).trim() || null) : ambassador.instagram_handle;
  const city = body.city !== undefined ? (String(body.city).trim() || null) : ambassador.city;
  const notes = body.notes !== undefined ? (String(body.notes).trim() || null) : ambassador.notes;
  const status = body.status !== undefined ? body.status : ambassador.status;
  const suspendedReason = body.suspendedReason !== undefined ? body.suspendedReason : ambassador.suspended_reason;
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE ambassadors
    SET 
      display_name = ?, full_name = ?, instagram_handle = ?,
      city = ?, notes = ?, status = ?, suspended_reason = ?, updated_at = ?
    WHERE id = ?
  `).run(
    displayName,
    fullName,
    instagramHandle,
    city,
    notes,
    status,
    suspendedReason,
    now,
    id
  );

  // If status changed to SUSPENDED, record milestone
  if (status !== ambassador.status) {
    db.prepare(`
      INSERT INTO ambassador_milestones (
        id, ambassador_id, kind, description, occurred_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      `mls_${crypto.randomUUID()}`,
      id,
      status === "SUSPENDED" ? "SUSPENDED" : "REACTIVATED",
      `تم تغيير حالة السفير إلى (${status}) ${suspendedReason ? `- السبب: ${suspendedReason}` : ""}`,
      now,
      auth.user.email
    );
  }

  recordChange("ambassadors", "ambassadors", id, Date.now());
  recordAudit({
    actor: auth.user.email,
    action: "UPDATE_AMBASSADOR",
    entity: "ambassadors",
    entityId: id,
    before: ambassador,
    after: { displayName, fullName, status, suspendedReason },
  });

  return apiSuccess({ ok: true, id, message: "تم تحديث بيانات السفير بنجاح." });
}
