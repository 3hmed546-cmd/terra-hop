import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb } from "@/lib/server/db";
import { processAndSaveAsset } from "@/lib/server/services/assets";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated) return auth.responseError!;

  const db = getDb();
  const assets = db
    .prepare(`
      SELECT 
        a.*,
        COUNT(p.id) as used_count
      FROM assets a
      LEFT JOIN image_placements p ON a.id = p.asset_id
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `)
    .all() as any[];

  const formatted = assets.map((a) => ({
    id: a.id,
    sha256: a.sha256,
    url: `/media/${a.sha256}.webp`,
    thumbUrl: `/media/${a.sha256}-thumb.webp`,
    mime: a.mime,
    width: a.width,
    height: a.height,
    bytes: a.bytes,
    originalName: a.original_name,
    usedCount: Number(a.used_count || 0),
    createdAt: a.created_at,
  }));

  return apiSuccess(formatted);
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("VALIDATION", "طلب الرفع غير صالح (يجب أن يكون FormData).", 400);
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return apiError("VALIDATION", "يرجى تحديد ملف الصورة للرفع.", 400, "file");
  }

  const originalName = file instanceof File ? file.name : "upload.webp";
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const asset = await processAndSaveAsset(buffer, originalName, auth.user.email);
    return apiSuccess({
      ...asset,
      url: `/media/${asset.sha256}.webp`,
      thumbUrl: `/media/${asset.sha256}-thumb.webp`,
    });
  } catch (err: any) {
    return apiError("UPLOAD_REJECTED", err?.message || "فشل معالجة ورفع الصورة.", 400);
  }
}
