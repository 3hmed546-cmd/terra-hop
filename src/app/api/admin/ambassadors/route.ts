import { NextRequest } from "next/server";
import crypto from "crypto";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb, recordAudit, recordChange } from "@/lib/server/db";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import { encryptCode, hashLookupCode, decryptCode, hashPassword } from "@/lib/server/security";
import { normalizePhone } from "@/lib/server/phone";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  const db = getDb();

  const ambassadors = db
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
      ORDER BY a.created_at DESC
    `)
    .all() as any[];

  // Attach active codes (decrypted on the fly)
  const items = ambassadors.map((amb) => {
    const codeRow = db
      .prepare(`
        SELECT id, encrypted_code, discount_percent, applies_to, is_active, used_count
        FROM referral_codes
        WHERE ambassador_id = ? AND is_active = 1
        ORDER BY created_at DESC
        LIMIT 1
      `)
      .get(amb.id) as any;

    let activeCode = "";
    if (codeRow?.encrypted_code) {
      activeCode = decryptCode(codeRow.encrypted_code);
    }

    return {
      id: amb.id,
      displayName: amb.display_name,
      fullName: amb.full_name,
      phone: amb.phone,
      email: amb.email,
      instagramHandle: amb.instagram_handle,
      city: amb.city,
      status: amb.status,
      joinedAt: amb.joined_at,
      code: activeCode,
      codeId: codeRow?.id || null,
      discountPercent: codeRow?.discount_percent ?? 10,
      appliesTo: codeRow?.applies_to ?? "ALL_PRODUCTS",
      maxUses: codeRow?.max_uses ?? null,
      usedCount: codeRow?.used_count ?? 0,
      netSales: amb.net_count ?? 0,
      pendingSales: amb.pending_count ?? 0,
      levelName: amb.level_name || "Starter",
      levelRank: amb.level_rank || 1,
      firstQualifiedAt: amb.first_qualified_at,
    };
  });

  // Calculate Overview KPIs
  const totalAmbassadors = items.length;
  const activeAmbassadors = items.filter((a) => a.status === "ACTIVE").length;
  const totalQualifiedSales = items.reduce((sum, a) => sum + a.netSales, 0);
  const totalPendingSales = items.reduce((sum, a) => sum + a.pendingSales, 0);

  const rewardsCountRow = db
    .prepare("SELECT COUNT(*) as c FROM ambassador_rewards WHERE status IN ('EARNED', 'ISSUED')")
    .get() as { c: number };
  const activeRewardsCount = Number(rewardsCountRow?.c || 0);

  return apiSuccess({
    items,
    overview: {
      totalAmbassadors,
      activeAmbassadors,
      totalQualifiedSales,
      totalPendingSales,
      activeRewardsCount,
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  const db = getDb();

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION", "بيانات غير صالحة.", 400);
  }

  const fullName = String(body.fullName || "").trim();
  const displayName = String(body.displayName || fullName).trim();

  // Code normalization & encryption
  const rawCode = String(body.code || displayName)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");

  if (fullName.length < 2) {
    return apiError("VALIDATION", "يرجى كتابة الاسم بالكامل.", 400, "fullName");
  }

  // Provide fallback phone and email if omitted in simplified referral form
  let phone = String(body.phone || "").trim();
  if (phone) {
    phone = normalizePhone(phone);
    if (!phone || phone.length < 10) {
      return apiError("VALIDATION", "يرجى إدخال رقم هاتف صحيح.", 400, "phone");
    }
  } else {
    phone = `010${Math.floor(10000000 + Math.random() * 90000000)}`;
  }

  let email = String(body.email || "").trim().toLowerCase();
  if (email) {
    if (!email.includes("@")) {
      return apiError("VALIDATION", "يرجى إدخال بريد إلكتروني صحيح.", 400, "email");
    }
  } else {
    const safeTag = (rawCode.toLowerCase() || crypto.randomUUID().slice(0, 8)).replace(/[^a-z0-9]/g, "");
    email = `ref_${safeTag}_${Date.now().toString(36)}@terrahop.internal`;
  }

  const instagramHandle = String(body.instagramHandle || "").trim() || null;
  const city = String(body.city || "").trim() || null;
  const notes = String(body.notes || "").trim() || null;

  // Check unique phone & email if real values provided
  if (body.phone || body.email) {
    const existingAmb = db
      .prepare("SELECT id FROM ambassadors WHERE phone = ? OR email = ?")
      .get(phone, email) as any;
    if (existingAmb) {
      return apiError("VALIDATION", "رقم الهاتف أو البريد الإلكتروني مسجل لسفير آخر بالفعل.", 409);
    }
  }

  if (rawCode.length < 3 || rawCode.length > 20) {
    return apiError("VALIDATION", "كود الخصم يجب أن يتكون من 3 إلى 20 حرف ورقم إنجليزي.", 400, "code");
  }

  const codeHash = hashLookupCode(rawCode);

  // Check code uniqueness across referral_codes and promo_codes
  const existingCode = db.prepare("SELECT id FROM referral_codes WHERE code_hash = ?").get(codeHash);
  const existingPromo = db.prepare("SELECT code FROM promo_codes WHERE code = ?").get(rawCode);
  if (existingCode || existingPromo) {
    return apiError("VALIDATION", "هذا الكود مستخدم بالفعل، يرجى اختيار كود آخر.", 409, "code");
  }

  const encryptedCode = encryptCode(rawCode);
  const discountPercent = Math.max(0, Math.min(100, Number(body.discountPercent) || 10));
  const appliesTo = body.appliesTo === "SELECTED" ? "SELECTED" : "ALL_PRODUCTS";
  const eligibleProductIds: string[] = Array.isArray(body.eligibleProductIds) ? body.eligibleProductIds : [];
  const maxUses = body.maxUses ? Math.max(1, Math.floor(Number(body.maxUses))) : null;

  const ambassadorId = `amb_${crypto.randomUUID()}`;
  const codeId = `rc_${crypto.randomUUID()}`;
  const portalUserId = `amb_usr_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const initialPassword = String(body.password || phone).trim();
  const passwordHash = hashPassword(initialPassword);

  const runTx = db.transaction(() => {
    // 1. Insert Ambassador Profile
    db.prepare(`
      INSERT INTO ambassadors (
        id, display_name, full_name, phone, email, instagram_handle,
        city, notes, status, joined_at, created_by_admin, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?)
    `).run(
      ambassadorId,
      displayName,
      fullName,
      phone,
      email,
      instagramHandle,
      city,
      notes,
      now,
      auth.user!.email,
      now,
      now
    );

    // 2. Insert Encrypted Referral Code
    db.prepare(`
      INSERT INTO referral_codes (
        id, ambassador_id, code_hash, encrypted_code, discount_percent,
        applies_to, max_uses, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      codeId,
      ambassadorId,
      codeHash,
      encryptedCode,
      discountPercent,
      appliesTo,
      maxUses,
      now
    );

    // 3. Product Scoping if SELECTED
    if (appliesTo === "SELECTED" && eligibleProductIds.length > 0) {
      const insertScope = db.prepare("INSERT INTO discount_code_products (code_id, product_id) VALUES (?, ?)");
      for (const pid of eligibleProductIds) {
        insertScope.run(codeId, pid);
      }
    }

    // 3b. Also insert into promo_codes as fallback
    try {
      db.prepare(`
        INSERT OR REPLACE INTO promo_codes (code, kind, value, active, starts_at, expires_at, max_uses, used, min_subtotal_cents)
        VALUES (?, 'percent', ?, 1, ?, NULL, ?, 0, 0)
      `).run(rawCode, discountPercent, now, maxUses || 10000);
    } catch {}

    // 4. Initialize Progress Cache
    db.prepare(`
      INSERT INTO ambassador_progress (
        ambassador_id, qualified_count, reversed_count, net_count, pending_count, updated_at
      ) VALUES (?, 0, 0, 0, 0, ?)
    `).run(ambassadorId, now);

    // 5. Initialize Portal User Account
    db.prepare(`
      INSERT INTO ambassador_users (
        id, ambassador_id, email, password_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(portalUserId, ambassadorId, email, passwordHash, now, now);

    // 6. Record Milestone
    db.prepare(`
      INSERT INTO ambassador_milestones (
        id, ambassador_id, kind, description, occurred_at, created_by
      ) VALUES (?, ?, 'FIRST_SALE_CONFIRMED', ?, ?, ?)
    `).run(
      `mls_${crypto.randomUUID()}`,
      ambassadorId,
      `انضمام السفير إلى برنامج الشارع وتفعيل الكود (${rawCode}) بنسبة خصم ${discountPercent}%`,
      now,
      auth.user!.email
    );
  });

  runTx();

  try {
    const fs = await import("fs");
    const path = await import("path");
    const vaultPath = path.join(process.cwd(), "data", "secure-vault", "ambassadors-data.json");
    let currentList: any[] = [];
    if (fs.existsSync(vaultPath)) {
      try {
        currentList = JSON.parse(fs.readFileSync(vaultPath, "utf-8"));
      } catch {}
    }
    currentList = currentList.filter((a) => a.id !== ambassadorId && a.code !== rawCode);
    currentList.push({
      id: ambassadorId,
      displayName,
      fullName,
      phone,
      email,
      instagramHandle,
      city,
      status: "ACTIVE",
      code: rawCode,
      aliases: [],
      discountPercent,
      appliesTo,
      eligibleProductIds,
      maxUses,
    });
    fs.writeFileSync(vaultPath, JSON.stringify(currentList, null, 2), "utf-8");
  } catch {}

  recordChange("ambassadors", "ambassadors", ambassadorId, 1);
  recordAudit({
    actor: auth.user.email,
    action: "CREATE_AMBASSADOR",
    entity: "ambassadors",
    entityId: ambassadorId,
    after: { displayName, phone, email, code: rawCode, discountPercent, appliesTo },
  });

  return apiSuccess({
    id: ambassadorId,
    displayName,
    fullName,
    phone,
    email,
    code: rawCode,
    discountPercent,
    appliesTo,
    initialPassword,
    message: "تم إنشاء السفير وتفعيل كود الخصم وحساب البورتال بنجاح.",
  });
}
