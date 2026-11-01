import { NextResponse } from "next/server";
import { getLatestRevision } from "@/lib/server/db";
import { apiSuccess } from "@/lib/server/api-envelope";

export async function GET() {
  const versions = {
    media: getLatestRevision("media"),
    products: getLatestRevision("products"),
    settings: getLatestRevision("settings"),
    content: getLatestRevision("content"),
    overall: getLatestRevision(),
  };

  return apiSuccess(versions, {
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
