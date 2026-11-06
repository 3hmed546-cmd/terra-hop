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

        let isClosed = false;
        let pingCounter = 0;

        const intervalId = setInterval(() => {
          if (isClosed) return;

          try {
            // Check for new changes in change_log
            const newChanges = db
              .prepare(`
                SELECT id, topic, entity, entity_id, revision, at
                FROM change_log
                WHERE id > ?
                ORDER BY id ASC
                LIMIT 50
              `)
              .all(lastSeenId) as any[];

            for (const change of newChanges) {
              lastSeenId = change.id;
              const dataStr = JSON.stringify({
                topic: change.topic,
                entity: change.entity,
                entityId: change.entity_id,
                revision: change.revision,
                at: change.at,
              });
              controller.enqueue(
                encoder.encode(`id: ${change.id}\nevent: change\ndata: ${dataStr}\n\n`)
              );
            }

            // Heartbeat ping every 15 seconds
            pingCounter++;
            if (pingCounter >= 15) {
              pingCounter = 0;
              controller.enqueue(encoder.encode(": ping\n\n"));
            }
          } catch {
            clearInterval(intervalId);
            try {
              controller.close();
            } catch {}
            isClosed = true;
          }
        }, 1000);

        request.signal.addEventListener("abort", () => {
          isClosed = true;
          clearInterval(intervalId);
          try {
            controller.close();
          } catch {}
        });
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
