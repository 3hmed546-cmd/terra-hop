import { NextRequest } from "next/server";
import { getDb } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { apiSuccess } from "@/lib/server/api-envelope";

/**
 * Format an ISO timestamp to 12-hour format in Arabic:
 * Example: "07:45 م" / "11:20 ص"
 */
function format12HourTime(isoString: string): { time12: string; dateFormatted: string } {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
      return { time12: "--:--", dateFormatted: "--" };
    }

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "م" : "ص";
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    const hoursStr = String(hours).padStart(2, "0");

    const time12 = `${hoursStr}:${minutes} ${ampm}`;

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const dateFormatted = `${year}/${month}/${day}`;

    return { time12, dateFormatted };
  } catch {
    return { time12: "--:--", dateFormatted: "--" };
  }
}

/**
 * Translate technical database action to friendly Arabic description
 */
function getActionArabicTitle(action: string, entity: string): string {
  const a = (action || "").toUpperCase();
  const e = (entity || "").toLowerCase();

  if (a === "LOGIN") return "تسجيل دخول إلى لوحة التحكم";
  if (a === "LOGOUT") return "تسجيل خروج";
  if (a === "CREATE_MANAGER") return "إضافة مسؤول جديد للنظام";
  if (a === "DELETE_MANAGER") return "حذف حساب مسؤول";
  if (a === "CHANGE_PASSWORD") return "تغيير كلمة المرور";
  if (a === "RESET_PASSWORD") return "استعادة كلمة المرور عبر OTP";
  if (a === "UPDATE_SETTINGS" || e === "settings") return "تعديل إعدادات المتجر";
  if (a === "UPDATE_ORDER" || e === "orders") return "تحديث بيانات أو حالة طلب";
  if (a === "CREATE_PRODUCT" || (a.includes("CREATE") && e.includes("product"))) return "إضافة منتج جديد";
  if (a === "UPDATE_PRODUCT" || (a.includes("UPDATE") && e.includes("product"))) return "تعديل بيانات منتج";
  if (a === "DELETE_PRODUCT" || (a.includes("DELETE") && e.includes("product"))) return "حذف منتج";
  if (a === "UPDATE_STOCK" || e.includes("stock")) return "تعديل رصيد المخزون";
  if (e === "promo_codes") return "إدارة وتعديل أكواد الخصم";
  if (e === "ambassadors") return "إدارة سفراء البراند";
  if (e === "assets") return "رفع أو حذف وسائط وصور";
  if (e === "image_slots" || e === "image_placements") return "تعديل بنرات وصور واجهة المتجر";

  return `عملية (${action}) على ${entity || "النظام"}`;
}

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) {
    return auth.responseError!;
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 100, 200);

  const db = getDb();
  const rows = db
    .prepare(`
      SELECT id, actor, action, entity, entity_id, before, after, ip, at
      FROM audit_log
      ORDER BY id DESC
      LIMIT ?
    `)
    .all(limit) as Array<{
      id: number;
      actor: string;
      action: string;
      entity: string;
      entity_id: string | null;
      before: string | null;
      after: string | null;
      ip: string | null;
      at: string;
    }>;

  const logs = rows.map((r) => {
    const { time12, dateFormatted } = format12HourTime(r.at);
    return {
      id: r.id,
      actor: r.actor || "مسؤول النظام",
      action: r.action,
      actionTitle: getActionArabicTitle(r.action, r.entity),
      entity: r.entity,
      entityId: r.entity_id,
      date: dateFormatted,
      time: time12,
      rawAt: r.at,
      ip: r.ip || "--",
    };
  });

  return apiSuccess({
    logs,
    total: logs.length,
  });
}
