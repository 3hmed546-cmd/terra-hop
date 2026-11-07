import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { apiSuccess, apiError } from "@/lib/server/api-envelope";
import {
  getWhatsAppBotStatus,
  initWhatsAppBot,
  logoutWhatsAppBot,
  isWhatsAppAutoSendEnabled,
  setWhatsAppAutoSendEnabled,
  toWhatsAppJid,
} from "@/lib/server/services/whatsapp-bot";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  const status = getWhatsAppBotStatus();
  const autoSend = isWhatsAppAutoSendEnabled();

  // If disconnected and never tried connecting, initiate connection to produce QR if needed
  if (status.status === "DISCONNECTED" && !status.error) {
    initWhatsAppBot().catch(() => {});
  }

  return apiSuccess({
    ...status,
    autoSend,
  });
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) return auth.responseError!;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION", "بيانات الطلب غير صالحة.", 400);
  }

  const action = body?.action;

  if (action === "connect") {
    await initWhatsAppBot();
    return apiSuccess({
      message: "جاري تشغيل اتصال الواتساب وتجهيز رمز QR...",
      status: getWhatsAppBotStatus(),
    });
  }

  if (action === "disconnect") {
    await logoutWhatsAppBot();
    return apiSuccess({
      message: "تم تسجيل الخروج وقطع اتصال الواتساب بنجاح.",
      status: getWhatsAppBotStatus(),
    });
  }

  if (action === "toggle_auto_send") {
    const enabled = Boolean(body?.enabled);
    setWhatsAppAutoSendEnabled(enabled);
    return apiSuccess({
      message: enabled ? "تم تفعيل الإرسال التلقائي للطلبات." : "تم تعطيل الإرسال التلقائي للطلبات.",
      autoSend: enabled,
    });
  }

  if (action === "test_message") {
    const phone = String(body?.phone || "").trim();
    const text = String(body?.message || "").trim();

    if (!phone || !text) {
      return apiError("VALIDATION", "يرجى إدخال رقم الهاتف ونص الرسالة التجريبية.", 400);
    }

    const sock = await initWhatsAppBot();
    const state = getWhatsAppBotStatus();

    if (!sock || state.status !== "CONNECTED") {
      return apiError("VALIDATION", "بوت الواتساب غير متصل حالياً. يرجى مسح رمز QR أولاً.", 400);
    }

    try {
      const jid = toWhatsAppJid(phone);
      await sock.sendMessage(jid, { text });
      return apiSuccess({
        sent: true,
        message: `تم إرسال الرسالة التجريبية بنجاح إلى الرقم (${phone})!`,
      });
    } catch (err: any) {
      return apiError("INTERNAL_ERROR", `فشل إرسال الرسالة: ${err?.message || "خطأ غير متوقع"}`, 500);
    }
  }

  return apiError("VALIDATION", "إجراء غير معروف.", 400);
}
