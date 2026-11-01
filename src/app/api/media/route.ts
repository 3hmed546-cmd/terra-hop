import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { INITIAL_GALLERY_IMAGES, type GalleryImage } from "@/lib/admin/gallery";

function getWritableStoragePath(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), "terra-gallery-data.json");
  }
  return path.join(process.cwd(), "data", "secure-vault", "gallery-data.json");
}

function getBundledStoragePath(): string {
  return path.join(process.cwd(), "data", "secure-vault", "gallery-data.json");
}

// Global in-memory cache for ultra-fast response
let memoryGallery: GalleryImage[] | null = null;
let memoryDeletedIds: Set<string> = new Set<string>();

async function loadPersistedGallery(): Promise<GalleryImage[]> {
  if (memoryGallery) return memoryGallery;

  // 1. Try reading from runtime writable cache (/tmp on Vercel)
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpPath = getWritableStoragePath();
    try {
      const raw = await fs.readFile(tmpPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryGallery = parsed.filter((img) => !memoryDeletedIds.has(img.id));
        return memoryGallery;
      }
    } catch {
      // Continue to bundled
    }
  }

  // 2. Try reading from bundled static repo file
  const bundledPath = getBundledStoragePath();
  try {
    const raw = await fs.readFile(bundledPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      memoryGallery = parsed.filter((img) => !memoryDeletedIds.has(img.id));
      return memoryGallery;
    }
  } catch {
    // If file doesn't exist yet, return initial
  }

  memoryGallery = INITIAL_GALLERY_IMAGES.filter((img) => !memoryDeletedIds.has(img.id));
  return memoryGallery;
}

async function savePersistedGallery(images: GalleryImage[]): Promise<void> {
  const clean = images.filter((img) => !memoryDeletedIds.has(img.id));
  memoryGallery = clean;

  const filePath = getWritableStoragePath();
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(clean, null, 2), "utf-8");
  } catch (err) {
    console.error("[Gallery Save Error]", err);
  }
}

// GET /api/media -> Returns active gallery images and deleted IDs
export async function GET() {
  try {
    const images = await loadPersistedGallery();
    return NextResponse.json(
      {
        ok: true,
        images,
        deletedIds: Array.from(memoryDeletedIds),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
        },
      }
    );
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Failed to load media" }, { status: 500 });
  }
}

// POST /api/media -> Update, delete, add, or sync gallery images
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Register any passed deletedIds
    if (Array.isArray(body.deletedIds)) {
      for (const id of body.deletedIds) {
        if (typeof id === "string" && id) memoryDeletedIds.add(id);
      }
    }

    if (body.action === "reset") {
      memoryDeletedIds.clear();
      await savePersistedGallery([...INITIAL_GALLERY_IMAGES]);
      return NextResponse.json({ ok: true, images: INITIAL_GALLERY_IMAGES, deletedIds: [] });
    }

    if (body.action === "delete" && body.id) {
      memoryDeletedIds.add(body.id);
      const current = await loadPersistedGallery();
      const next = current.filter((img) => img.id !== body.id && !memoryDeletedIds.has(img.id));
      await savePersistedGallery(next);
      return NextResponse.json({ ok: true, images: next, deletedIds: Array.from(memoryDeletedIds) });
    }

    if (body.action === "add" && body.image) {
      if (body.image.id) memoryDeletedIds.delete(body.image.id);
      const current = await loadPersistedGallery();
      const next = [body.image, ...current.filter((img) => img.id !== body.image.id && !memoryDeletedIds.has(img.id))];
      await savePersistedGallery(next);
      return NextResponse.json({ ok: true, images: next, deletedIds: Array.from(memoryDeletedIds) });
    }

    if (body.action === "sync" && Array.isArray(body.images)) {
      const clean = (body.images as GalleryImage[]).filter((img: GalleryImage) => !memoryDeletedIds.has(img.id));
      await savePersistedGallery(clean);
      return NextResponse.json({ ok: true, images: clean, deletedIds: Array.from(memoryDeletedIds) });
    }

    if (Array.isArray(body.images)) {
      const clean = (body.images as GalleryImage[]).filter((img: GalleryImage) => !memoryDeletedIds.has(img.id));
      await savePersistedGallery(clean);
      return NextResponse.json({ ok: true, images: clean, deletedIds: Array.from(memoryDeletedIds) });
    }

    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  } catch (err) {
    console.error("[API Media POST Error]", err);
    return NextResponse.json({ ok: false, error: "Failed to update media" }, { status: 500 });
  }
}
