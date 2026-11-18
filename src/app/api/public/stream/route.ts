import { NextRequest } from "next/server";
import { getDb, getLatestRevision } from "@/lib/server/db";

export async function GET(request: NextRequest) {
  try {
    const db = getDb();

    // Read last seen ID from Last-Event-ID header if reconnecting
    const lastEventIdHeader = request.headers.get("last-event-id");
    let lastSeenId = lastEventIdHeader ? parseInt(lastEventIdHeader, 10) : 0;

    if (lastSeenId === 0) {
      const maxRow = db.prepare("SELECT MAX(id) as max_id FROM change_log").get() as {
        max_id: number | null;
      };
      lastSeenId = maxRow?.max_id ?? 0;
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        // Send initial comment to establish stream without protocol error
        controller.enqueue(encoder.encode(": ok\n\n"));

        // Send initial readiness event with latest topic revisions
        const initialRevisions = {
          media: getLatestRevision("media"),
          products: getLatestRevision("products"),
          settings: getLatestRevision("settings"),
          content: getLatestRevision("content"),
        };

        controller.enqueue(
          encoder.encode(`event: ready\ndata: ${JSON.stringify({ revisions: initialRevisions })}\n\n`)
        );

        // Close stream quickly to prevent holding Passenger workers indefinitely on cPanel
        setTimeout(() => {
          try {
            controller.close();
          } catch {}
        }, 200);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform, no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: any) {
    if (error?.digest?.startsWith?.("NEXT_") || error?.message?.includes?.("bail out")) {
      throw error;
    }
    console.error("Stream SSE error:", error);
    return new Response("Service Unavailable", { status: 503 });
  }
}
