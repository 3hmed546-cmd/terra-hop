"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { apiFetch } from "@/lib/admin-auth";
import { PageHeader } from "../PageHeader";
import { Button, TextInput, Textarea, useToast, StatusBadge } from "../ui";

interface BotStatus {
  status: "DISCONNECTED" | "CONNECTING" | "SCAN_QR" | "CONNECTED";
  phoneNumber: string | null;
  qrCodeDataUrl: string | null;
  lastConnectedAt: string | null;
  error: string | null;
  autoSend?: boolean;
}

export function WhatsAppManager() {
  const toast = useToast();
  const [data, setData] = useState<BotStatus>({
    status: "CONNECTING",
    phoneNumber: null,
    qrCodeDataUrl: null,
    lastConnectedAt: null,
    error: null,
    autoSend: true,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testMsg, setTestMsg] = useState("أهلاً بك! هذه رسالة تجريبية من بوت واتساب متجر TERRA HOP 🖤");
  const [sendingTest, setSendingTest] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiFetch("/api/admin/whatsapp/status", { cache: "no-store" });
      const json = await res.json();
      if (json.ok && json.data) {
        setData(json.data);
      }
    } catch (e) {
      console.error("Failed to fetch WhatsApp bot status:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Poll every 3 seconds if not connected yet to detect QR scan automatically
    const interval = setInterval(() => {
      fetchStatus();
    }, 3500);

    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleConnect = async () => {
    setActionLoading(true);
    try {
      const res = await apiFetch("/api/admin/whatsapp/status", {
        method: "POST",
        body: JSON.stringify({ action: "connect" }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.push(json.data.message || "جاري الاتصال وتوليد رمز QR...");
        fetchStatus();
      } else {
        toast.push(json.message || "حدث خطأ أثناء الاتصال.");
      }
    } catch {
      toast.push("فشل الاتصال بالخادم.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("هل أنت متأكد من رغبتك في تسجيل الخروج وفصل جلسة الواتساب؟")) return;
    setActionLoading(true);
    try {
      const res = await apiFetch("/api/admin/whatsapp/status", {
        method: "POST",
        body: JSON.stringify({ action: "disconnect" }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.push(json.data.message || "تم قطع الاتصال بنجاح.");
        fetchStatus();
      } else {
        toast.push(json.message || "حدث خطأ أثناء فصل الاتصال.");
      }
    } catch {
      toast.push("فشل الاتصال بالخادم.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAutoSend = async () => {
    const nextVal = !data.autoSend;
    try {
      const res = await apiFetch("/api/admin/whatsapp/status", {
        method: "POST",
        body: JSON.stringify({ action: "toggle_auto_send", enabled: nextVal }),
      });
      const json = await res.json();
      if (json.ok) {
        setData((prev) => ({ ...prev, autoSend: nextVal }));
        toast.push(json.data.message);
      }
    } catch {
      toast.push("فشل تحديث الإعدادات.");
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone) {
      toast.push("يرجى إدخال رقم الهاتف للتجربة.");
      return;
    }
    setSendingTest(true);
    try {
      const res = await apiFetch("/api/admin/whatsapp/status", {
        method: "POST",
        body: JSON.stringify({
          action: "test_message",
          phone: testPhone,
          message: testMsg,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.push(json.data.message || "تم إرسال الرسالة بنجاح!");
      } else {
        toast.push(json.message || "فشل إرسال الرسالة.");
      }
    } catch {
      toast.push("حدث خطأ في الخادم.");
    } finally {
      setSendingTest(false);
    }
  };

  const isConnected = data.status === "CONNECTED";

  return (
    <div className="adm-page">
      <PageHeader
        title="بوت الواتساب التلقائي"
        description="إرسال صور وتفاصيل الهوديز للعملاء تلقائياً مع نظام التأكيد التفاعلي مجاناً."
        actions={
          <div style={{ display: "flex", gap: "8px" }}>
            {isConnected ? (
              <Button
                variant="secondary"
                onClick={handleDisconnect}
                disabled={actionLoading}
                style={{ borderColor: "#dc2626", color: "#dc2626" }}
              >
                قطع الاتصال
              </Button>
            ) : (
              <Button onClick={handleConnect} disabled={actionLoading}>
                {actionLoading ? "جاري التجهيز..." : "تحديث الاتصال / رمز QR"}
              </Button>
            )}
          </div>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px", marginTop: "20px" }}>
        {/* Status Card */}
        <section className="adm-card" style={{ padding: "24px" }}>
          <h2 className="adm-h2" style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
            <span>حالة اتصال البوت</span>
            {isConnected ? (
              <span className="adm-badge" style={{ backgroundColor: "#15803d", color: "#fff", fontSize: "12px", padding: "4px 8px", borderRadius: "6px" }}>
                متصل 🟢
              </span>
            ) : data.status === "SCAN_QR" ? (
              <span className="adm-badge" style={{ backgroundColor: "#ca8a04", color: "#fff", fontSize: "12px", padding: "4px 8px", borderRadius: "6px" }}>
                بانتظار المسح 🟡
              </span>
            ) : (
              <span className="adm-badge" style={{ backgroundColor: "#b91c1c", color: "#fff", fontSize: "12px", padding: "4px 8px", borderRadius: "6px" }}>
                غير متصل 🔴
              </span>
            )}
          </h2>

          {isConnected ? (
            <div style={{ lineHeight: "1.8" }}>
              <div style={{ padding: "16px", backgroundColor: "rgba(22, 163, 74, 0.1)", borderRadius: "8px", border: "1px solid rgba(22, 163, 74, 0.2)" }}>
                <p style={{ margin: "0 0 8px 0", fontWeight: 600, color: "#16a34a" }}>
                  البوت يعمل الآن ومتصل برقم واتساب المتجر!
                </p>
                <p style={{ margin: 0, fontSize: "14px" }}>
                  <strong>الرقم المتصل:</strong> <span dir="ltr">+{data.phoneNumber || "مربوط"}</span>
                </p>
                {data.lastConnectedAt ? (
                  <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.8 }}>
                    آخر تسجيل دخول: {new Date(data.lastConnectedAt).toLocaleString("ar-EG")}
                  </p>
                ) : null}
              </div>

              <div style={{ marginTop: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px", backgroundColor: "#f9fafb", borderRadius: "8px" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>إرسال رسائل التأكيد التلقائية</div>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>
                    إرسال صورة الهودي وتفاصيل الطلب للعميل فور إكمال الشراء
                  </div>
                </div>
                <Button
                  variant={data.autoSend ? "primary" : "secondary"}
                  onClick={handleToggleAutoSend}
                  style={{ minWidth: "100px" }}
                >
                  {data.autoSend ? "مُفعّل ✔" : "مُعطّل"}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: "14px", color: "#4b5563", marginBottom: "16px", lineHeight: "1.6" }}>
                اربط رقم هاتف المتجر ليعمل البوت كخدمة عملاء آلية ترسل للعملاء فوراً.
              </p>

              {data.qrCodeDataUrl ? (
                <div style={{ textAlign: "center", padding: "16px", backgroundColor: "#fff", borderRadius: "12px", border: "2px dashed #e5e7eb" }}>
                  <img
                    src={data.qrCodeDataUrl}
                    alt="WhatsApp QR Code"
                    width={240}
                    height={240}
                    style={{ margin: "0 auto", display: "block", borderRadius: "8px" }}
                  />
                  <div style={{ marginTop: "12px", fontSize: "13px", color: "#374151", fontWeight: 600 }}>
                    1. افتح تطبيق واتساب على هاتفك.<br />
                    2. اضغط على القائمة (أو الإعدادات) واختر <strong>الأجهزة المرتبطة</strong>.<br />
                    3. اضغط على <strong>ربط جهاز</strong> ووجّه الكاميرا نحو الرمز أعلاه.
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "30px 20px", backgroundColor: "#f9fafb", borderRadius: "8px", border: "1px dashed #d1d5db" }}>
                  <p style={{ margin: "0 0 12px 0", color: "#6b7280" }}>
                    {data.status === "CONNECTING" ? "جاري تجهيز اتصال الواتساب..." : "الرمز غير معروض حالياً."}
                  </p>
                  <Button onClick={handleConnect} disabled={actionLoading}>
                    {actionLoading ? "جاري التحميل..." : "عرض رمز QR للربط"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Test Message Card */}
        <section className="adm-card" style={{ padding: "24px" }}>
          <h2 className="adm-h2" style={{ marginBottom: "16px" }}>تجربة إرسال رسالة</h2>
          <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>
            يمكنك إرسال رسالة تيست لأي رقم موبايل للتأكد من أن البوت يرسل بسلاسة.
          </p>

          <form onSubmit={handleSendTest} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <TextInput
              label="رقم الهاتف (مع كود مصر أو بدونه)"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="مثال: 01012345678"
              dir="ltr"
            />

            <Textarea
              label="نص الرسالة التجريبية"
              rows={3}
              value={testMsg}
              onChange={(e) => setTestMsg(e.target.value)}
            />

            <Button
              type="submit"
              disabled={sendingTest || !isConnected}
              style={{ alignSelf: "flex-start", marginTop: "4px" }}
            >
              {sendingTest ? "جاري الإرسال..." : isConnected ? "إرسال رسالة تجريبية 🚀" : "البوت غير متصل"}
            </Button>
          </form>

          {/* Workflow explanation */}
          <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #e5e7eb", fontSize: "12px", color: "#4b5563", lineHeight: "1.6" }}>
            <strong>💡 كيف يعمل النظام تلقائياً؟</strong>
            <ul style={{ paddingRight: "16px", margin: "6px 0 0 0" }}>
              <li>عند إتمام العميل للطلب: تصله صورة الهودي والمقاس واللون والعنوان والمبلغ المطلوب.</li>
              <li>عند تفاعل العميل بـ (👍) أو رده بكلمة (تأكيد): تتغير حالة الطلب فوراً إلى مؤكد في لوحة التحكم.</li>
              <li>عند رد العميل بـ (إلغاء): يتم إلغاء الطلب تلقائياً وتنبيهك في لوحة التحكم.</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
