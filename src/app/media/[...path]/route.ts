import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getUploadsDir } from "@/lib/server/services/assets";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await context.params;
  const requestedPath = pathSegments.join("/");

  // 1. Check storage/uploads first (hashed webp assets)
  const uploadsDir = getUploadsDir();
  const filePath = path.normalize(path.join(uploadsDir, requestedPath));

  // Security: prevent directory traversal
  if (!filePath.startsWith(uploadsDir)) {
    return new NextResponse("Access Denied", { status: 403 });
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(fileBuffer.length),
      },
    });
  }

  // 2. Fallback to public/ directory for existing static images
  const publicDir = path.join(process.cwd(), "public");
  const fallbackPath = path.normalize(path.join(publicDir, requestedPath));

  if (fallbackPath.startsWith(publicDir) && fs.existsSync(fallbackPath) && fs.statSync(fallbackPath).isFile()) {
    const ext = path.extname(fallbackPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".webp": "image/webp",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
    };
    const mime = mimeTypes[ext] || "application/octet-stream";
    const fileBuffer = fs.readFileSync(fallbackPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=86400",
        "Content-Length": String(fileBuffer.length),
      },
    });
  }

  return new NextResponse("Not Found", { status: 404 });
}
