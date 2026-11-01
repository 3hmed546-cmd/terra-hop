import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { INITIAL_GALLERY_IMAGES, type GalleryImage } from "@/lib/admin/gallery";

function getStoragePath(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), "terra-gallery-data.json");
  }
  return path.join(process.cwd(), "data", "secure-vault", "gallery-data.json");
}

// Global in-memory cache for ultra-fast response
let memoryGallery: GalleryImage[] | null = null;

async function loadPersistedGallery(): Promise<GalleryImage[]> {
  if (memoryGallery) return memoryGallery;

  const filePath = getStoragePath();
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      memoryGallery = parsed;
      return memoryGallery;
    }
  } catch {
    // If file doesn't exist yet, return initial
  }

  memoryGallery = [...INITIAL_GALLERY_IMAGES];
  return memoryGallery;
}

async function savePersistedGallery(images: GalleryImage[]): Promise<void> {
  memoryGallery = images;
  const filePath = getStoragePath();
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(images, null, 2), "utf-8");
  } catch (err) {
    console.error("[Gallery Save Error]", err);
  }
}

// GET /api/media -> Returns active gallery images
export async function GET() {
  try {
    const images = await loadPersistedGallery();
    return NextResponse.json(
      { ok: true, images },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (err) {
    return NextResponse.json({ ok: false, error: "Failed to load media" }, { status: 500 });
  }
}

// POST /api/media -> Update, delete, or add gallery images
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === "reset") {
      await savePersistedGallery([...INITIAL_GALLERY_IMAGES]);
      return NextResponse.json({ ok: true, images: INITIAL_GALLERY_IMAGES });
    }

    if (body.action === "delete" && body.id) {
      const current = await loadPersistedGallery();
      const next = current.filter((img) => img.id !== body.id);
      await savePersistedGallery(next);
      return NextResponse.json({ ok: true, images: next });
    }

    if (body.action === "add" && body.image) {
      const current = await loadPersistedGallery();
      const next = [body.image, ...current];
      await savePersistedGallery(next);
      return NextResponse.json({ ok: true, images: next });
    }

    if (Array.isArray(body.images)) {
      await savePersistedGallery(body.images);
      return NextResponse.json({ ok: true, images: body.images });
    }

    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  } catch (err) {
    console.error("[API Media POST Error]", err);
    return NextResponse.json({ ok: false, error: "Failed to update media" }, { status: 500 });
  }
}
