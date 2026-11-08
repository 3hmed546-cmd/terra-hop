export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      console.log("[INSTRUMENTATION] Booting WhatsApp bot service...");
      const { initWhatsAppBot } = await import("@/lib/server/services/whatsapp-bot");
      initWhatsAppBot().catch((err) => {
        console.error("[INSTRUMENTATION:WA_INIT_ERROR]", err);
      });
    } catch (err) {
      console.error("[INSTRUMENTATION:REGISTER_ERROR]", err);
    }
  }
}
