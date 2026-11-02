import { NextRequest } from "next/server";
import { getDb } from "@/lib/server/db";
import { verifyAmbassadorSessionToken, decryptCode } from "@/lib/server/security";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { getAmbassadorRewards } from "@/lib/server/ambassadors/rewards";

export async function GET(request: NextRequest) {
  let sessionToken = request.cookies.get("terra_amb_session")?.value;
  if (!sessionToken) {
    const authHeader = request.headers.get("authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      sessionToken = authHeader.slice(7).trim();
    }
  }

  if (!sessionToken) {
    return apiError("UNAUTHENTICATED", "جلسة السفير غير موجودة. يرجى تسجيل الدخول.", 401);
  }

  const verified = verifyAmbassadorSessionToken(sessionToken);
  if (!verified.valid || !verified.ambassadorId) {
    return apiError("UNAUTHENTICATED", "انتهت صلاحية جلسة السفير. يرجى تسجيل الدخول مجدداً.", 401);
  }

  const db = getDb();
  const ambassadorId = verified.ambassadorId;

  const amb = db
    .prepare(`
      SELECT 
        a.id, a.display_name, a.full_name, a.phone, a.email,
        a.instagram_handle, a.city, a.status, a.joined_at,
        ap.qualified_count, ap.net_count, ap.pending_count,
        ap.first_qualified_at, al.name as level_name, al.rank as level_rank,
        al.threshold_sales as level_threshold
      FROM ambassadors a
      LEFT JOIN ambassador_progress ap ON a.id = ap.ambassador_id
      LEFT JOIN ambassador_levels al ON ap.current_level_id = al.id
      WHERE a.id = ?
    `)
    .get(ambassadorId) as any;

  if (!amb) {
    return apiError("NOT_FOUND", "بيانات السفير غير موجودة.", 404);
  }

  if (amb.status === "SUSPENDED") {
    return apiError("FORBIDDEN", "تم إيقاف حسابك مؤقتاً من قبل الإدارة.", 403);
  }

  // Active Referral Code
  const codeRow = db
    .prepare(`
      SELECT encrypted_code, discount_percent, applies_to, used_count
      FROM referral_codes
      WHERE ambassador_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .get(ambassadorId) as any;

  const activeCode = codeRow?.encrypted_code ? decryptCode(codeRow.encrypted_code) : "";

  // Next level progress calculation
  const netSales = amb.net_count || 0;
  const allLevels = db
    .prepare("SELECT * FROM ambassador_levels WHERE is_enabled = 1 ORDER BY threshold_sales ASC")
    .all() as any[];

  let currentLevelObj = allLevels[0];
  let nextLevelObj: any = null;

  for (let i = 0; i < allLevels.length; i++) {
    if (netSales >= allLevels[i].threshold_sales) {
      currentLevelObj = allLevels[i];
      nextLevelObj = allLevels[i + 1] || null;
    } else {
      if (!nextLevelObj) nextLevelObj = allLevels[i];
      break;
    }
  }

  const nextThreshold = nextLevelObj ? nextLevelObj.threshold_sales : currentLevelObj.threshold_sales;
  const currentThreshold = currentLevelObj.threshold_sales;
  const salesNeededForNext = nextLevelObj ? Math.max(0, nextLevelObj.threshold_sales - netSales) : 0;
  const progressPercent = nextLevelObj
    ? Math.min(100, Math.round((netSales / nextLevelObj.threshold_sales) * 100))
    : 100;

  // Rewards & Vouchers
  const rewards = getAmbassadorRewards(db, ambassadorId);

  // Redacted Orders List (Masked reference e.g. TH-1***, Date, Status, Units - Zero customer PII)
  const orderRows = db
    .prepare(`
      SELECT id, number, fulfilment_status, payment_status, created_at, delivered_at
      FROM orders
      WHERE ambassador_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `)
    .all(ambassadorId) as any[];

  const salesHistory = orderRows.map((o) => {
    // Mask order number e.g. TH-1025 -> TH-10**
    const rawNum = o.number || "TH-0000";
    const maskedNum = rawNum.length > 5 ? rawNum.slice(0, 5) + "**" : rawNum;

    let stateLabel = "قيد التوصيل والتحصيل";
    let isDelivered = false;
    if (o.fulfilment_status === "DELIVERED" && o.payment_status === "PAID") {
      stateLabel = "مؤكد ومحصّل (محتسب)";
      isDelivered = true;
    } else if (o.fulfilment_status === "RETURNED" || o.payment_status === "REFUNDED") {
      stateLabel = "مرتجع / مسترد";
    }

    return {
      id: o.id,
      maskedNumber: maskedNum,
      stateLabel,
      isDelivered,
      createdAt: o.created_at,
      deliveredAt: o.delivered_at,
      units: 1,
    };
  });

  return apiSuccess({
    profile: {
      id: amb.id,
      displayName: amb.display_name,
      fullName: amb.full_name,
      phone: amb.phone,
      email: amb.email,
      instagramHandle: amb.instagram_handle,
      status: amb.status,
      joinedAt: amb.joined_at,
      firstQualifiedAt: amb.first_qualified_at,
    },
    code: {
      code: activeCode,
      discountPercent: codeRow?.discount_percent ?? 10,
      appliesTo: codeRow?.applies_to ?? "ALL_PRODUCTS",
      usedCount: codeRow?.used_count ?? 0,
    },
    stats: {
      netSales,
      qualifiedSales: amb.qualified_count || 0,
      pendingSales: amb.pending_count || 0,
      currentLevelName: amb.level_name || currentLevelObj?.name || "Starter",
      currentLevelRank: amb.level_rank || currentLevelObj?.rank || 1,
      nextLevelName: nextLevelObj?.name || null,
      nextThreshold,
      salesNeededForNext,
      progressPercent,
    },
    rewards,
    salesHistory,
  });
}
