export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { hasSavedSession, initWhatsAppBot } = await import("@/lib/server/services/whatsapp-bot");
      if (hasSavedSession()) {
        console.log("[INSTRUMENTATION] Existing WhatsApp session found. Reconnecting...");
        initWhatsAppBot().catch((err) => {
          console.error("[INSTRUMENTATION:WA_INIT_ERROR]", err);
        });
      } else {
        console.log("[INSTRUMENTATION] No existing WhatsApp session. Waiting for admin pairing.");
      }
    } catch (err) {
      console.error("[INSTRUMENTATION:REGISTER_ERROR]", err);
    }
  }
}
