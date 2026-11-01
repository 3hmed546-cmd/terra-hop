export interface GalleryImage {
  id: string;
  title: string;
  src: string;
  category: "header" | "clothing";
  tag: string;
  addedAt: string;
}

export const INITIAL_GALLERY_IMAGES: GalleryImage[] = [
  // --- صور الهيدر والواجهة الرئيسية (Header & Hero Images) ---
  {
    id: "hdr-1",
    title: "هودي أزرق ترابي (Dusty Blue)",
    src: "/login-hoodies/hoodie-dusty-blue.webp",
    category: "header",
    tag: "هيدر كاروسيل",
    addedAt: "2026-10-25",
  },
  {
    id: "hdr-3",
    title: "هودي بني شوكولاتة (Vintage Brown)",
    src: "/login-hoodies/hoodie-chocolate.webp",
    category: "header",
    tag: "هيدر كاروسيل",
    addedAt: "2026-10-25",
  },
  {
    id: "hdr-4",
    title: "هودي أخضر غامق (Forest Green)",
    src: "/login-hoodies/hoodie-forest.webp",
    category: "header",
    tag: "هيدر كاروسيل",
    addedAt: "2026-10-25",
  },
  {
    id: "hdr-5",
    title: "هودي تيل غامق (Deep Teal)",
    src: "/login-hoodies/hoodie-deep-teal.webp",
    category: "header",
    tag: "هيدر كاروسيل",
    addedAt: "2026-10-25",
  },
  {
    id: "hdr-6",
    title: "هودي رمادي فحمي (Charcoal)",
    src: "/login-hoodies/hoodie-charcoal.webp",
    category: "header",
    tag: "هيدر كاروسيل",
    addedAt: "2026-10-25",
  },
  {
    id: "hdr-7",
    title: "هودي كحلي أردوازي (Slate Navy)",
    src: "/login-hoodies/hoodie-slate-navy.webp",
    category: "header",
    tag: "هيدر كاروسيل",
    addedAt: "2026-10-25",
  },
  {
    id: "hdr-8",
    title: "هودي بيج رملي (Sand Beige)",
    src: "/login-hoodies/hoodie-sand-beige.webp",
    category: "header",
    tag: "هيدر كاروسيل",
    addedAt: "2026-10-25",
  },
  {
    id: "hdr-9",
    title: "هودي أسود كلاسيك (Classic Black)",
    src: "/login-hoodies/hoodie-black.webp",
    category: "header",
    tag: "هيدر كاروسيل",
    addedAt: "2026-10-25",
  },
  {
    id: "hdr-10",
    title: "بانر الهيدر الرئيسي (Main Hero Banner)",
    src: "/preview-images/hero.jpg",
    category: "header",
    tag: "بانر واجهة",
    addedAt: "2026-10-25",
  },
];

export const GALLERY_STORAGE_KEY = "terra_hop_gallery_images_v4";
export const DELETED_IDS_STORAGE_KEY = "terra_hop_deleted_image_ids_v4";
export const CUSTOM_IMAGES_STORAGE_KEY = "terra_hop_custom_images_v4";
export const GALLERY_CHANNEL_NAME = "terra_gallery_channel";

export function getDeletedImageIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DELETED_IDS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markImageDeleted(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getDeletedImageIds();
    if (!existing.includes(id)) {
      const updated = [...existing, id];
      localStorage.setItem(DELETED_IDS_STORAGE_KEY, JSON.stringify(updated));
    }
    // Also remove from custom images if present
    const custom = getCustomImages().filter((img) => img.id !== id);
    localStorage.setItem(CUSTOM_IMAGES_STORAGE_KEY, JSON.stringify(custom));
  } catch {
    // ignore
  }
}

export function getCustomImages(): GalleryImage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_IMAGES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomImage(img: GalleryImage): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getCustomImages().filter((i) => i.id !== img.id);
    localStorage.setItem(CUSTOM_IMAGES_STORAGE_KEY, JSON.stringify([img, ...existing]));
  } catch {
    // ignore
  }
}

export function loadGalleryImages(): GalleryImage[] {
  if (typeof window === "undefined") return INITIAL_GALLERY_IMAGES;
  const deletedIds = new Set(getDeletedImageIds());
  const customImages = getCustomImages().filter((img) => !deletedIds.has(img.id));

  try {
    const raw = localStorage.getItem(GALLERY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter out any image marked as deleted
        const active = parsed.filter((img: GalleryImage) => !deletedIds.has(img.id));
        // Ensure custom images are preserved
        const missingCustom = customImages.filter((c) => !active.some((a) => a.id === c.id));
        return [...missingCustom, ...active];
      }
    }
  } catch {
    // fallback
  }

  // Fallback to initial minus deleted plus custom
  const cleanInitial = INITIAL_GALLERY_IMAGES.filter((img) => !deletedIds.has(img.id));
  const missingCustom = customImages.filter((c) => !cleanInitial.some((a) => a.id === c.id));
  return [...missingCustom, ...cleanInitial];
}

let mediaSyncTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedMediaSync(cleanImages: GalleryImage[], deletedIds: Set<string>) {
  if (typeof window === "undefined") return;
  if (mediaSyncTimer) clearTimeout(mediaSyncTimer);
  mediaSyncTimer = setTimeout(() => {
    fetch("/api/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync", images: cleanImages, deletedIds: Array.from(deletedIds) }),
    }).catch(() => {});
  }, 500);
}

export function saveGalleryImages(images: GalleryImage[], notifyServerAndTabs: boolean = true): void {
  if (typeof window === "undefined") return;
  const deletedIds = new Set(getDeletedImageIds());
  const cleanImages = images.filter((img) => !deletedIds.has(img.id));

  try {
    localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(cleanImages));
  } catch {
    // ignore quota errors
  }

  if (notifyServerAndTabs) {
    // 1. Broadcast to other tabs & windows instantly with 0ms delay
    if (typeof BroadcastChannel !== "undefined") {
      try {
        const bc = new BroadcastChannel(GALLERY_CHANNEL_NAME);
        bc.postMessage({ type: "UPDATE", images: cleanImages });
        bc.close();
      } catch {
        // ignore
      }
    }

    // 2. Dispatch custom DOM event for same-tab real-time subscribers
    try {
      window.dispatchEvent(new CustomEvent("terra_gallery_changed", { detail: cleanImages }));
    } catch {
      // ignore
    }

    // 3. Persist to server API with debounce to avoid rate limiting
    debouncedMediaSync(cleanImages, deletedIds);
  }
}

export async function deleteGalleryImage(id: string): Promise<GalleryImage[]> {
  markImageDeleted(id);
  const current = loadGalleryImages();
  const next = current.filter((img) => img.id !== id);
  // Update local storage and DOM without redundant second API call
  saveGalleryImages(next, false);

  try {
    fetch("/api/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id, deletedIds: getDeletedImageIds() }),
    }).catch(() => {});
  } catch {
    // ignore
  }

  return next;
}

export async function addGalleryImage(image: GalleryImage): Promise<GalleryImage[]> {
  saveCustomImage(image);
  const current = loadGalleryImages();
  const next = [image, ...current.filter((img) => img.id !== image.id)];
  // Update local storage and DOM without redundant second API call
  saveGalleryImages(next, false);

  try {
    fetch("/api/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", image, customImages: getCustomImages() }),
    }).catch(() => {});
  } catch {
    // ignore
  }

  return next;
}

export async function resetGalleryImages(): Promise<GalleryImage[]> {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(DELETED_IDS_STORAGE_KEY);
      localStorage.removeItem(CUSTOM_IMAGES_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  saveGalleryImages(INITIAL_GALLERY_IMAGES, true);

  try {
    fetch("/api/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    }).catch(() => {});
  } catch {
    // ignore
  }

  return INITIAL_GALLERY_IMAGES;
}
