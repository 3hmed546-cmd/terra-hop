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
    id: "hdr-2",
    title: "هودي كريمي أوف وايت (Off-White)",
    src: "/login-hoodies/hoodie-offwhite.webp",
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

  // --- صور الملابس والمنتجات (Clothing & Products Images) ---
  {
    id: "clt-1",
    title: "تيشيرت أوفرسايز أسود (وجه أمامي)",
    src: "/preview-images/tee-black-1.jpg",
    category: "clothing",
    tag: "تيشيرت",
    addedAt: "2026-10-26",
  },
  {
    id: "clt-2",
    title: "تيشيرت أوفرسايز أسود (ظهر)",
    src: "/preview-images/tee-black-2.jpg",
    category: "clothing",
    tag: "تيشيرت",
    addedAt: "2026-10-26",
  },
  {
    id: "clt-3",
    title: "تيشيرت أوفرسايز رمادي (وجه أمامي)",
    src: "/preview-images/tee-grey-1.jpg",
    category: "clothing",
    tag: "تيشيرت",
    addedAt: "2026-10-26",
  },
  {
    id: "clt-4",
    title: "تيشيرت أوفرسايز رمادي (ظهر)",
    src: "/preview-images/tee-grey-2.jpg",
    category: "clothing",
    tag: "تيشيرت",
    addedAt: "2026-10-26",
  },
  {
    id: "clt-5",
    title: "تيشيرت أوفرسايز أوف وايت (وجه أمامي)",
    src: "/preview-images/tee-offwhite-1.jpg",
    category: "clothing",
    tag: "تيشيرت",
    addedAt: "2026-10-26",
  },
  {
    id: "clt-6",
    title: "تيشيرت أوفرسايز أوف وايت (ظهر)",
    src: "/preview-images/tee-offwhite-2.jpg",
    category: "clothing",
    tag: "تيشيرت",
    addedAt: "2026-10-26",
  },
  {
    id: "clt-7",
    title: "هودي ستريت وير بريميوم 01",
    src: "/preview-images/hoodie-1.jpg",
    category: "clothing",
    tag: "هودي",
    addedAt: "2026-10-27",
  },
  {
    id: "clt-8",
    title: "هودي ستريت وير بريميوم 02",
    src: "/preview-images/hoodie-2.jpg",
    category: "clothing",
    tag: "هودي",
    addedAt: "2026-10-27",
  },
  {
    id: "clt-9",
    title: "لوك بوك أزياء الشارع 01",
    src: "/preview-images/look-1.jpg",
    category: "clothing",
    tag: "لوك بوك",
    addedAt: "2026-10-27",
  },
  {
    id: "clt-10",
    title: "لوك بوك أزياء الشارع 02",
    src: "/preview-images/look-2.jpg",
    category: "clothing",
    tag: "لوك بوك",
    addedAt: "2026-10-27",
  },
  {
    id: "clt-11",
    title: "لوك بوك أزياء الشارع 03",
    src: "/preview-images/look-3.jpg",
    category: "clothing",
    tag: "لوك بوك",
    addedAt: "2026-10-27",
  },
  {
    id: "clt-12",
    title: "لوك بوك أزياء الشارع 04",
    src: "/preview-images/look-4.jpg",
    category: "clothing",
    tag: "لوك بوك",
    addedAt: "2026-10-27",
  },
];

export const GALLERY_STORAGE_KEY = "terra_hop_gallery_images_v2";
export const GALLERY_CHANNEL_NAME = "terra_gallery_channel";

export function loadGalleryImages(): GalleryImage[] {
  if (typeof window === "undefined") return INITIAL_GALLERY_IMAGES;
  try {
    const raw = localStorage.getItem(GALLERY_STORAGE_KEY);
    if (!raw) return INITIAL_GALLERY_IMAGES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fallback
  }
  return INITIAL_GALLERY_IMAGES;
}

export function saveGalleryImages(images: GalleryImage[], notifyServerAndTabs: boolean = true): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(images));
  } catch {
    // ignore quota errors
  }

  if (notifyServerAndTabs) {
    // 1. Broadcast to other tabs & windows instantly with 0ms delay
    if (typeof BroadcastChannel !== "undefined") {
      try {
        const bc = new BroadcastChannel(GALLERY_CHANNEL_NAME);
        bc.postMessage({ type: "UPDATE", images });
        bc.close();
      } catch {
        // ignore
      }
    }

    // 2. Dispatch custom DOM event for same-tab real-time subscribers
    try {
      window.dispatchEvent(new CustomEvent("terra_gallery_changed", { detail: images }));
    } catch {
      // ignore
    }

    // 3. Persist to server API in background
    try {
      fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      }).catch(() => {});
    } catch {
      // ignore
    }
  }
}

export async function deleteGalleryImage(id: string): Promise<GalleryImage[]> {
  const current = loadGalleryImages();
  const next = current.filter((img) => img.id !== id);
  saveGalleryImages(next, true);

  try {
    fetch("/api/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    }).catch(() => {});
  } catch {
    // ignore
  }

  return next;
}

export async function addGalleryImage(image: GalleryImage): Promise<GalleryImage[]> {
  const current = loadGalleryImages();
  const next = [image, ...current];
  saveGalleryImages(next, true);

  try {
    fetch("/api/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", image }),
    }).catch(() => {});
  } catch {
    // ignore
  }

  return next;
}

export async function resetGalleryImages(): Promise<GalleryImage[]> {
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
