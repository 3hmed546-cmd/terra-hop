import { NextResponse } from "next/server";
import fs from "fs";
import { getDb } from "@/lib/server/db";
import { getUploadsDir } from "@/lib/server/services/assets";

export async function GET() {
  const health: Record<string, any> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  };

  try {
    const db = getDb();
    const row = db.prepare("SELECT 1 as alive").get() as { alive: number };
    health.database = row.alive === 1 ? "connected" : "error";
  } catch (err: any) {
    health.status = "degraded";
    health.database = `error: ${err?.message || "connection failed"}`;
  }

  try {
    const dir = getUploadsDir();
    health.storage = fs.existsSync(dir) ? "writable" : "missing";
  } catch (err: any) {
    health.status = "degraded";
    health.storage = `error: ${err?.message || "directory access failed"}`;
  }

  return NextResponse.json(health, {
    status: health.status === "ok" ? 200 : 503,
  });
}
