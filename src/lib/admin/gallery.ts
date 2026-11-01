import { apiFetch } from "@/lib/admin-auth";

export interface GalleryImage {
  id: string;
  title: string;
  src: string;
  category: "header" | "clothing";
  tag: string;
  addedAt: string;
  meta?: any;
}

export const GALLERY_CHANNEL_NAME = "terra_gallery_channel";

/**
 * Fetch hero carousel images directly from authoritative database
 */
export async function fetchHeroImages(): Promise<GalleryImage[]> {
  try {
    const res = await apiFetch("/api/admin/slots/hero_carousel", { cache: "no-store" });
    if (!res.ok) throw new Error("تعذر جلب صور الهيدر من الخادم.");
    const payload = await res.json();
    if (!payload.ok || !payload.data) throw new Error(payload.error?.message || "خطأ في قراءة بيانات الصور.");

    const items = payload.data.items || [];
    return items.map((item: any) => ({
      id: item.id,
      title: item.altAr || item.altEn || "صورة هيدر",
      src: item.url,
      category: "header" as const,
      tag: "هيدر كاروسيل",
      addedAt: (item.createdAt || "").split("T")[0] || new Date().toISOString().split("T")[0],
      meta: item.meta,
    }));
  } catch (err: any) {
    throw new Error(err?.message || "تعذر الاتصال بالخادم لجلب الصور.");
  }
}

/**
 * Authoritative delete from database (verified write)
 */
export async function deleteHeroImage(id: string): Promise<void> {
  const res = await apiFetch(`/api/admin/slots/hero_carousel/items/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload.ok) {
    throw new Error(payload.error?.message || "فشل حذف الصورة من قاعدة البيانات.");
  }

  // Broadcast to other tabs
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const bc = new BroadcastChannel(GALLERY_CHANNEL_NAME);
      bc.postMessage({ type: "UPDATE", deletedId: id });
      bc.close();
    } catch {}
  }
}

/**
 * Authoritative upload & add to hero carousel in database
 */
export async function addHeroImage(data: {
  file?: File | Blob;
  title: string;
  meta?: any;
}): Promise<GalleryImage> {
  const formData = new FormData();
  if (data.file) {
    formData.append("file", data.file);
  }
  formData.append("altAr", data.title);
  formData.append("altEn", data.title);
  if (data.meta) {
    formData.append("meta", JSON.stringify(data.meta));
  }

  const res = await apiFetch("/api/admin/slots/hero_carousel/items", {
    method: "POST",
    body: formData,
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error?.message || "فشل إضافة الصورة في قاعدة البيانات.");
  }

  const item = payload.data;

  // Broadcast to other tabs
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const bc = new BroadcastChannel(GALLERY_CHANNEL_NAME);
      bc.postMessage({ type: "UPDATE", addedId: item.id });
      bc.close();
    } catch {}
  }

  return {
    id: item.id,
    title: item.altAr,
    src: item.url,
    category: "header",
    tag: "هيدر كاروسيل",
    addedAt: new Date().toISOString().split("T")[0],
    meta: item.meta,
  };
}

/**
 * Reorder items in slot
 */
export async function reorderHeroImages(ids: string[]): Promise<void> {
  const res = await apiFetch("/api/admin/slots/hero_carousel/order", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || !payload.ok) {
    throw new Error(payload.error?.message || "فشل حفظ الترتيب الجديد في قاعدة البيانات.");
  }
}
