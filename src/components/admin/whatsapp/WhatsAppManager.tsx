"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { apiFetch } from "@/lib/admin-auth";
import { PageHeader } from "../PageHeader";
import { Button, TextInput, Textarea, useToast, StatusBadge } from "../ui";
import { buildProductCaptionTemplate, renderCaptionForCustomer } from "@/lib/broadcast-templates";

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

  // Broadcast & Confirmed Customers State
  const [broadcastData, setBroadcastData] = useState<{
    confirmedCustomersCount: number;
    recentCustomers: any[];
    products: any[];
  }>({
    confirmedCustomersCount: 0,
    recentCustomers: [],
    products: [],
  });
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [customCaption, setCustomCaption] = useState<string>("");
  const [captionEditedManually, setCaptionEditedManually] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);

  const fetchBroadcastData = useCallback(async () => {
    try {
      const res = await apiFetch("/api/admin/whatsapp/broadcast", { cache: "no-store" });
      const json = await res.json();
      if (json.ok && json.data) {
        const prods = json.data.products || [];
        setBroadcastData({
          confirmedCustomersCount: json.data.confirmedCustomersCount || 0,
          recentCustomers: json.data.recentCustomers || [],
          products: prods,
        });
        if (prods.length > 0 && !selectedProductId) {
          const first = prods[0];
          setSelectedProductId(first.id);
          setCustomCaption(buildProductCaptionTemplate(first));
        }
      }
    } catch (e) {
      console.error("Failed to fetch broadcast data:", e);
    }
  }, [selectedProductId]);

  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = broadcastData.products.find((p) => p.id === prodId);
    if (prod) {
      setCustomCaption(buildProductCaptionTemplate(prod));
      setCaptionEditedManually(false);
    }
  };

  const handleResetCaption = () => {
    const prod = broadcastData.products.find((p) => p.id === selectedProductId) || broadcastData.products[0];
    if (prod) {
      setCustomCaption(buildProductCaptionTemplate(prod));
      setCaptionEditedManually(false);
      toast.push("تمت استعادة النموذج الافتراضي ببيانات المنتج الحالي.");
    }
  };

  const handleInsertTag = (tag: string) => {
    setCustomCaption((prev) => (prev ? `${prev} ${tag}` : tag));
    setCaptionEditedManually(true);
  };

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
    fetchBroadcastData();
    // Poll every 3 seconds if not connected yet to detect QR scan automatically
    const interval = setInterval(() => {
      fetchStatus();
    }, 3500);

    return () => clearInterval(interval);
  }, [fetchStatus, fetchBroadcastData]);

  const handleSendBroadcast = async () => {
    if (!selectedProductId) {
      toast.push("يرجى اختيار المنتج أولاً.");
      return;
    }
    if (broadcastData.confirmedCustomersCount === 0) {
      toast.push("لا يوجد عملاء مؤكدين في الخزنة حالياً.");
      return;
    }
    if (!confirm(`هل أنت متأكد من إرسال إشعار هذا المنتج الجديد إلى ${broadcastData.confirmedCustomersCount} عميل مؤكد عبر الواتساب؟`)) {
      return;
    }

    setBroadcasting(true);
    try {
      const res = await apiFetch("/api/admin/whatsapp/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedProductId,
          customCaption: customCaption.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.push(json.data?.message || "تم إرسال البث للعملاء بنجاح! 🎉");
      } else {
        toast.push(json.message || "فشل إرسال البث.");
      }
    } catch {
      toast.push("حدث خطأ أثناء إرسال البث.");
    } finally {
      setBroadcasting(false);
    }
  };

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
              <li>عند تأكيد الشحن وتحديد أيام التوصيل من لوحة التحكم: تصله رسالة تفاصيل الشحن والموعد المتوقع على الواتساب.</li>
              <li>عند تأكيد الاستلام: يُحفظ العميل مشفراً في الخزنة وتصله رسالة شكر وترحيب في عائلة VIP.</li>
            </ul>
          </div>
        </section>
      </div>

      {/* New Product VIP Broadcast & Confirmed Customers Section */}
      <div style={{ marginTop: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Broadcast Card */}
        <section className="adm-card" style={{ padding: "24px", backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
            <div>
              <h2 className="adm-h2" style={{ margin: "0 0 6px 0", display: "flex", alignItems: "center", gap: "10px" }}>
                <span>📢 بث المنتجات الجديدة للعملاء المؤكدين</span>
                <span className="adm-badge" style={{ backgroundColor: "#0284c7", color: "#fff", fontSize: "12px", padding: "4px 8px", borderRadius: "6px" }}>
                  VIP Broadcast
                </span>
              </h2>
              <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
                إرسال رسالة حب وتقدير مخصصة باسم العميل مع تفاصيل القطعة الجديدة والمقاسات والألوان المتاحة ورابط الطلب المباشر.
              </p>
            </div>

            <div style={{ padding: "8px 16px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", textAlign: "center" }}>
              <div style={{ fontSize: "11px", color: "#166534", fontWeight: 600 }}>العملاء المؤكدين في الخزنة 🔒</div>
              <div style={{ fontSize: "18px", fontWeight: 800, color: "#15803d" }}>
                {broadcastData.confirmedCustomersCount} عميل
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px", marginTop: "20px" }}>
            {/* Form Controls */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>
                  اختر المنتج المراد إرسال رسالته للعملاء:
                </label>
                {broadcastData.products.length > 0 ? (
                  <select
                    className="adm-input"
                    value={selectedProductId}
                    onChange={(e) => handleProductChange(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "13px" }}
                  >
                    {broadcastData.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nameAr} - {Math.round(p.priceCents / 100)} ج.م
                      </option>
                    ))}
                  </select>
                ) : (
                  <p style={{ fontSize: "13px", color: "#6b7280" }}>لا توجد منتجات نشطة في المتجر حالياً.</p>
                )}
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 700 }}>
                    تعديل نص الرسالة (الكابشن) بالكامل:
                  </label>
                  <button
                    type="button"
                    onClick={handleResetCaption}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#0284c7",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    🔄 استعادة النموذج الافتراضي
                  </button>
                </div>

                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", color: "#6b7280", alignSelf: "center" }}>إدراج متغير:</span>
                  {[
                    { label: "اسم العميل", tag: "{customerName}" },
                    { label: "اسم المنتج", tag: "{productName}" },
                    { label: "السعر", tag: "{price}" },
                    { label: "الألوان", tag: "{colors}" },
                    { label: "المقاسات", tag: "{sizes}" },
                    { label: "رابط المتجر", tag: "{url}" },
                  ].map((t) => (
                    <button
                      key={t.tag}
                      type="button"
                      onClick={() => handleInsertTag(t.tag)}
                      style={{
                        padding: "2px 8px",
                        fontSize: "11px",
                        borderRadius: "4px",
                        border: "1px solid #d1d5db",
                        backgroundColor: "#f3f4f6",
                        cursor: "pointer",
                      }}
                    >
                      + {t.label}
                    </button>
                  ))}
                </div>

                <textarea
                  className="adm-input"
                  rows={14}
                  value={customCaption}
                  onChange={(e) => {
                    setCustomCaption(e.target.value);
                    setCaptionEditedManually(true);
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d1d5db",
                    fontSize: "13px",
                    lineHeight: "1.6",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                  placeholder="اكتب أو عدل نص رسالة الواتساب هنا..."
                />
                <p style={{ fontSize: "11px", color: "#6b7280", margin: "4px 0 0 0" }}>
                  💡 يمكنك تعديل أي سطر في الرسالة كما تشاء. وسيتم وضع تفاصيل المنتج والأسعار والألوان والمقاسات تلقائياً.
                </p>
              </div>

              <div style={{ padding: "14px", backgroundColor: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px", color: "#4b5563", lineHeight: "1.7" }}>
                <strong>🛡️ حماية وضمانات البث:</strong>
                <div>• يُرسل بفاصل زمني هادئ (1.5 ثانية) لحماية رقم الواتساب من القيود.</div>
                <div>• يصل فقط للعملاء الذين أكدوا واستلموا أوردرات سابقة من المتجر.</div>
                <div>• المعاينة على اليسار تُظهر لك بالضبط كيف ستظهر الرسالة في محادثة الواتساب.</div>
              </div>

              <Button
                onClick={handleSendBroadcast}
                disabled={broadcasting || !isConnected || broadcastData.confirmedCustomersCount === 0 || !selectedProductId}
                style={{
                  backgroundColor: "#16a34a",
                  color: "#ffffff",
                  padding: "12px 20px",
                  fontSize: "14px",
                  fontWeight: 700,
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                {broadcasting
                  ? "جاري إرسال البث للعملاء عبر الواتساب... ⏳"
                  : `إرسال الإشعار لجميع العملاء المؤكدين (${broadcastData.confirmedCustomersCount} عميل) 🚀`}
              </Button>
            </div>

            {/* Live WhatsApp Bubble Preview */}
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}>
                معاينة الرسالة الحقيقية في محادثة الواتساب:
              </label>

              {(() => {
                const prod = broadcastData.products.find((p) => p.id === selectedProductId) || broadcastData.products[0];
                if (!prod) return <p style={{ color: "#6b7280", fontSize: "12px" }}>اختر منتجاً للمعاينة</p>;

                const previewText = renderCaptionForCustomer(
                  customCaption || buildProductCaptionTemplate(prod),
                  { name: "أحمد عبد الرحمن" },
                  prod
                );

                return (
                  <div
                    style={{
                      backgroundColor: "#0b141a",
                      backgroundImage: "radial-gradient(#12222d 1px, transparent 1px)",
                      backgroundSize: "16px 16px",
                      borderRadius: "12px",
                      padding: "16px",
                      color: "#e9edef",
                      fontFamily: "system-ui, -apple-system, sans-serif",
                      fontSize: "13px",
                      lineHeight: "1.6",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: "#202c33",
                        borderRadius: "10px",
                        padding: "12px",
                        maxWidth: "96%",
                        margin: "0 auto",
                        border: "1px solid #2a3942",
                      }}
                    >
                      {prod.imageUrl ? (
                        <div style={{ marginBottom: "12px", borderRadius: "8px", overflow: "hidden", border: "1px solid #374248" }}>
                          <img
                            src={prod.imageUrl}
                            alt={prod.nameAr}
                            style={{ width: "100%", maxHeight: "240px", objectFit: "cover", display: "block" }}
                          />
                        </div>
                      ) : null}

                      <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", direction: "rtl", textAlign: "right" }}>
                        {previewText.split("\n").map((line, idx) => {
                          if (!line.trim()) return <div key={idx} style={{ height: "8px" }} />;

                          const isBoldHeader = line.startsWith("*") && line.endsWith("*");
                          const hasLink = line.includes("http://") || line.includes("https://");

                          if (hasLink) {
                            return (
                              <div key={idx} style={{ margin: "2px 0" }}>
                                <span style={{ color: "#53bdeb", textDecoration: "underline", direction: "ltr", display: "inline-block" }}>
                                  {line}
                                </span>
                              </div>
                            );
                          }

                          if (isBoldHeader) {
                            return (
                              <div key={idx} style={{ fontWeight: 700, margin: "2px 0" }}>
                                {line.replace(/^\*|\*$/g, "")}
                              </div>
                            );
                          }

                          const parts = line.split(/(\*[^*]+\*)/g);
                          return (
                            <div key={idx} style={{ margin: "1px 0" }}>
                              {parts.map((p, pIdx) => {
                                if (p.startsWith("*") && p.endsWith("*")) {
                                  return <strong key={pIdx}>{p.slice(1, -1)}</strong>;
                                }
                                return <span key={pIdx}>{p}</span>;
                              })}
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ textAlign: "left", fontSize: "10px", color: "#8696a0", marginTop: "10px", direction: "ltr" }}>
                        10:27 pm ✓✓
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </section>

        {/* Confirmed Customers Vault Table */}
        <section className="adm-card" style={{ padding: "24px", backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h2 className="adm-h2" style={{ margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>👥 سجل العملاء المؤكدين</span>
                <span className="adm-badge" style={{ backgroundColor: "#15803d", color: "#fff", fontSize: "11px", padding: "2px 8px" }}>
                  مشفر عسكرياً AES-256-GCM 🔒
                </span>
              </h2>
              <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
                يتم حفظ كل عميل استلم أوردره تلقائياً ومشفر في قاعدة البيانات لضمان خصوصية بياناته وخدمته مستقبلاً.
              </p>
            </div>
          </div>

          {broadcastData.recentCustomers.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "right" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e5e7eb", color: "#4b5563" }}>
                    <th style={{ padding: "10px 12px" }}>اسم العميل</th>
                    <th style={{ padding: "10px 12px" }}>رقم الهاتف (مشفر)</th>
                    <th style={{ padding: "10px 12px", textAlign: "center" }}>عدد الطلبات</th>
                    <th style={{ padding: "10px 12px" }}>إجمالي المشتريات</th>
                    <th style={{ padding: "10px 12px" }}>آخر طلب</th>
                    <th style={{ padding: "10px 12px", textAlign: "center" }}>حالة التشفير</th>
                  </tr>
                </thead>
                <tbody>
                  {broadcastData.recentCustomers.map((c) => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{c.name}</td>
                      <td style={{ padding: "10px 12px", direction: "ltr", textAlign: "right", fontFamily: "monospace" }}>
                        {c.maskedPhone}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>{c.ordersCount} أوردر</td>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>
                        {Math.round((c.totalSpentCents || 0) / 100)} ج.م
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {c.lastOrderNumber ? (
                          <span style={{ fontFamily: "monospace", color: "#0284c7" }}>#{c.lastOrderNumber}</span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center" }}>
                        <span style={{ fontSize: "11px", backgroundColor: "#f0fdf4", color: "#166534", padding: "3px 8px", borderRadius: "4px", border: "1px solid #bbf7d0" }}>
                          مشفر وآمن 🔒
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: "24px", textAlign: "center", color: "#6b7280", fontSize: "13px" }}>
              لا يوجد عملاء تم تأكيد استلامهم للطلبات حتى الآن. بمجرد تأكيد استلام أي أوردر، سيظهر العميل هنا تلقائياً وتُحفظ بياناته مشفرة.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
