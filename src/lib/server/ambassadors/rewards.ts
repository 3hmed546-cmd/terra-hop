import crypto from "crypto";
import type Database from "better-sqlite3";
import { encryptCode, hashLookupCode, decryptCode } from "../security";

export interface RewardEvaluationResult {
  newRewardsEarned: Array<{
    id: string;
    levelName: string;
    rewardTitle: string;
    type: string;
    voucherCode?: string;
  }>;
  netCount: number;
  currentLevel: any | null;
}

/**
 * Generate a clean cryptographic voucher code without ambiguous letters
 * Example: RISE-9K2F-7X4W
 */
export function generateVoucherCode(prefix = "RISE"): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const pick = (len: number) => {
    const bytes = crypto.randomBytes(len);
    let str = "";
    for (let i = 0; i < len; i++) {
      str += chars[bytes[i] % chars.length];
    }
    return str;
  };
  return `${prefix}-${pick(4)}-${pick(4)}`;
}

/**
 * Idempotent evaluation of ambassador rewards based on append-only sale events.
 */
export function evaluateAmbassadorRewards(
  db: Database.Database,
  ambassadorId: string
): RewardEvaluationResult {
  const now = new Date().toISOString();

  // 1. Calculate authoritative totals from ledger
  const stats = db
    .prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN event_type = 'QUALIFIED' THEN units ELSE 0 END), 0) as qualified,
        COALESCE(SUM(CASE WHEN event_type LIKE 'REVERSED_%' THEN units ELSE 0 END), 0) as reversed
      FROM ambassador_sale_events
      WHERE ambassador_id = ?
    `)
    .get(ambassadorId) as { qualified: number; reversed: number };

  const qualifiedCount = Number(stats?.qualified || 0);
  const reversedCount = Number(stats?.reversed || 0);
  const netCount = Math.max(0, qualifiedCount - reversedCount);

  // 2. Pending orders count (attributed, but not yet delivered/paid, and not cancelled)
  const pendingRow = db
    .prepare(`
      SELECT COUNT(*) as c
      FROM orders
      WHERE ambassador_id = ? 
        AND (fulfilment_status IS NULL OR fulfilment_status NOT IN ('DELIVERED', 'RETURNED', 'DELIVERY_FAILED'))
        AND status NOT IN ('CANCELLED', 'EXPIRED')
    `)
    .get(ambassadorId) as { c: number };
  const pendingCount = Number(pendingRow?.c || 0);

  // 3. Resolve Highest Level Reached
  const levels = db
    .prepare(`
      SELECT * FROM ambassador_levels 
      WHERE is_enabled = 1 
      ORDER BY threshold_sales ASC
    `)
    .all() as any[];

  let currentLevel: any | null = null;
  const reachedLevels: any[] = [];
  for (const lvl of levels) {
    if (netCount >= lvl.threshold_sales) {
      reachedLevels.push(lvl);
      currentLevel = lvl;
    }
  }

  // 4. Update Ambassador Progress Cache
  db.prepare(`
    INSERT INTO ambassador_progress (
      ambassador_id, qualified_count, reversed_count, net_count, pending_count,
      current_level_id, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (ambassador_id) DO UPDATE SET
      qualified_count = excluded.qualified_count,
      reversed_count = excluded.reversed_count,
      net_count = excluded.net_count,
      pending_count = excluded.pending_count,
      current_level_id = excluded.current_level_id,
      updated_at = excluded.updated_at
  `).run(
    ambassadorId,
    qualifiedCount,
    reversedCount,
    netCount,
    pendingCount,
    currentLevel?.id || null,
    now
  );

  const newRewardsEarned: RewardEvaluationResult["newRewardsEarned"] = [];

  // 5. Evaluate rewards for each reached level
  for (const lvl of reachedLevels) {
    const rewardDefs = db
      .prepare(`
        SELECT * FROM reward_definitions
        WHERE level_id = ? AND is_enabled = 1
      `)
      .all(lvl.id) as any[];

    for (const def of rewardDefs) {
      const rewardId = `rwd_${crypto.randomUUID()}`;
      const cycle = 1;

      // Unique check (ambassador_id, reward_definition_id, cycle)
      const existing = db
        .prepare(`
          SELECT * FROM ambassador_rewards
          WHERE ambassador_id = ? AND reward_definition_id = ? AND cycle = ?
        `)
        .get(ambassadorId, def.id, cycle) as any;

      if (!existing) {
        const requiresApproval = def.requires_admin_approval === 1;
        const status = requiresApproval ? "PENDING_APPROVAL" : "ISSUED";
        const validityDays = def.validity_days || 30;
        const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString();

        db.prepare(`
          INSERT INTO ambassador_rewards (
            id, ambassador_id, level_id, reward_definition_id,
            definition_snapshot, cycle, status, earned_at, issued_at, expires_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          rewardId,
          ambassadorId,
          lvl.id,
          def.id,
          JSON.stringify(def),
          cycle,
          status,
          now,
          requiresApproval ? null : now,
          expiresAt
        );

        let issuedVoucherCode: string | undefined;

        // If it's a voucher type reward, generate encrypted single-use voucher
        if (def.type === "PERCENT_DISCOUNT_VOUCHER") {
          const rawCode = generateVoucherCode("RISE");
          const codeHash = hashLookupCode(rawCode);
          const encryptedCode = encryptCode(rawCode);
          const voucherId = `vch_${crypto.randomUUID()}`;

          db.prepare(`
            INSERT INTO reward_vouchers (
              id, reward_id, ambassador_id, code_hash, encrypted_code,
              discount_percent, max_discount_cents, eligible_category,
              status, expires_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
          `).run(
            voucherId,
            rewardId,
            ambassadorId,
            codeHash,
            encryptedCode,
            def.discount_percent || 80,
            def.max_discount_cents || null,
            def.eligible_category || "Hoodies",
            expiresAt,
            now
          );

          issuedVoucherCode = rawCode;
        }

        // Record Milestone
        db.prepare(`
          INSERT INTO ambassador_milestones (
            id, ambassador_id, kind, level_id, description, occurred_at, created_by
          ) VALUES (?, ?, 'REWARD_ISSUED', ?, ?, ?, 'system')
        `).run(
          `mls_${crypto.randomUUID()}`,
          ambassadorId,
          lvl.id,
          `تم فتح مكافأة جديدة: ${def.title} (${lvl.name})`,
          now
        );

        newRewardsEarned.push({
          id: rewardId,
          levelName: lvl.name,
          rewardTitle: def.title,
          type: def.type,
          voucherCode: issuedVoucherCode,
        });
      }
    }
  }

  return {
    newRewardsEarned,
    netCount,
    currentLevel,
  };
}

/**
 * Get all decrypted rewards for an ambassador
 */
export function getAmbassadorRewards(db: Database.Database, ambassadorId: string) {
  const rows = db
    .prepare(`
      SELECT 
        ar.*,
        rd.title,
        rd.description,
        rd.type,
        al.name as level_name,
        al.rank as level_rank,
        rv.id as voucher_id,
        rv.encrypted_code as voucher_enc,
        rv.status as voucher_status,
        rv.discount_percent as voucher_percent,
        rv.expires_at as voucher_expires_at,
        rv.redeemed_at as voucher_redeemed_at
      FROM ambassador_rewards ar
      JOIN reward_definitions rd ON ar.reward_definition_id = rd.id
      JOIN ambassador_levels al ON ar.level_id = al.id
      LEFT JOIN reward_vouchers rv ON rv.reward_id = ar.id
      WHERE ar.ambassador_id = ?
      ORDER BY ar.earned_at DESC
    `)
    .all(ambassadorId) as any[];

  return rows.map((r) => {
    let voucherCode: string | undefined;
    if (r.voucher_enc) {
      voucherCode = decryptCode(r.voucher_enc);
    }
    return {
      id: r.id,
      levelName: r.level_name,
      levelRank: r.level_rank,
      title: r.title,
      description: r.description,
      type: r.type,
      status: r.status,
      earnedAt: r.earned_at,
      issuedAt: r.issued_at,
      expiresAt: r.expires_at,
      voucher: r.voucher_id
        ? {
            id: r.voucher_id,
            code: voucherCode,
            status: r.voucher_status,
            discountPercent: r.voucher_percent,
            expiresAt: r.voucher_expires_at,
            redeemedAt: r.voucher_redeemed_at,
          }
        : null,
    };
  });
}
