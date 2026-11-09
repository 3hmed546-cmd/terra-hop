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
  const [broadcastCustomNote, setBroadcastCustomNote] = useState<string>("الحق اطلب قبل نهاية الاسبوع واستمتع بعرض الشحن 9 جنية فقط لكل الجمهورية");
  const [broadcasting, setBroadcasting] = useState(false);

  const fetchBroadcastData = useCallback(async () => {
    try {
      const res = await apiFetch("/api/admin/whatsapp/broadcast", { cache: "no-store" });
      const json = await res.json();
      if (json.ok && json.data) {
        setBroadcastData({
          confirmedCustomersCount: json.data.confirmedCustomersCount || 0,
          recentCustomers: json.data.recentCustomers || [],
          products: json.data.products || [],
        });
        if (json.data.products?.length > 0 && !selectedProductId) {
          setSelectedProductId(json.data.products[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to fetch broadcast data:", e);
    }
  }, [selectedProductId]);

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
          customNote: broadcastCustomNote.trim() || undefined,
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px", marginTop: "20px" }}>
            {/* Form Controls */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "6px" }}>
                  اختر المنتج المراد إرساله للعملاء:
                </label>
                {broadcastData.products.length > 0 ? (
                  <select
                    className="adm-input"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
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
                <TextInput
                  label="عرض الشحن أو ملاحظة خاصة (تظهر في مقدمة الرسالة)"
                  value={broadcastCustomNote}
                  onChange={(e) => setBroadcastCustomNote(e.target.value)}
                  placeholder="مثال: الحق اطلب قبل نهاية الاسبوع واستمتع بعرض الشحن 9 جنية فقط لكل الجمهورية"
                />
              </div>

              <div style={{ padding: "14px", backgroundColor: "#f9fafb", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px", color: "#4b5563", lineHeight: "1.7" }}>
                <strong>🛡️ حماية ضد الحظر والتكرار:</strong>
                <div>• الرسائل تُرسل بفاصل زمني آمن لتفادي قيود واتساب.</div>
                <div>• تصل فقط للعملاء الذين أكدوا واستلموا أوردرات سابقة من المتجر.</div>
                <div>• يتم توجيه الرسالة باسم العميل المخصص مع رسالة تقدير لمعاملته السابقة.</div>
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
                معاينة الرسالة كما ستصل للعميل على الواتساب:
              </label>

              {(() => {
                const prod = broadcastData.products.find((p) => p.id === selectedProductId) || broadcastData.products[0];
                if (!prod) return <p style={{ color: "#6b7280", fontSize: "12px" }}>اختر منتجاً للمعاينة</p>;

                const price = Math.round(prod.priceCents / 100);
                const compare = prod.compareAtCents ? Math.round(prod.compareAtCents / 100) : null;
                const colors = prod.colors?.length ? prod.colors.join(" - ") : "جميع الألوان متوفرة";
                const sizes = prod.sizes?.length ? prod.sizes.join(" ، ") : "S, M, L, XL, XXL";

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
                        maxWidth: "92%",
                        margin: "0 auto",
                        border: "1px solid #2a3942",
                      }}
                    >
                      {prod.imageUrl ? (
                        <div style={{ marginBottom: "10px", borderRadius: "8px", overflow: "hidden", border: "1px solid #374248" }}>
                          <img
                            src={prod.imageUrl}
                            alt={prod.nameAr}
                            style={{ width: "100%", maxHeight: "200px", objectFit: "cover", display: "block" }}
                          />
                        </div>
                      ) : null}

                      <div style={{ whiteSpace: "pre-line", wordBreak: "break-word" }}>
                        {`🖤 *رسالة خاصة ومميزة من TERRA HOP* 🖤\n`}
                        {`أهلاً يا *أحمد عبد الرحمن* 👋\n`}
                        {`وحشتنا جداً! بنشكرك من قلبنا على ثقتك فينا في تعاملك الأخير معانا 🖤 ويسعدنا دائماً إنك من عيلتنا المميزة.\n\n`}
                        {broadcastCustomNote ? `📢 *${broadcastCustomNote}*\n\n` : ""}
                        {`حبينا تكون أول حد يعرف إننا نزلنا قطعة جديدة ومميزة جداً تليق بذوقك:\n`}
                        {`🔥 *${prod.nameAr}* 🔥\n`}
                        {`💰 *السعر:* *${price} ج.م* ${compare ? `~(بدلاً من ${compare} ج.م)~` : ""}\n`}
                        {`🎨 *الألوان المتاحة:* ${colors}\n`}
                        {`📏 *المقاسات المتاحة:* ${sizes}\n\n`}
                        {prod.descriptionAr ? `✨ *تفاصيل ومميزات القطعة:*\n${prod.descriptionAr}\n\n` : ""}
                        {`🛡️ *مع ميزة المعاينة والتجربة المجانية عند الاستلام مع مندوب الشحن قبل دفع أي مليم، هتشوف الفينش العالي بنفسك!*\n\n`}
                        {`🛒 *اطلب مقاسك ولونك المفضل دلوقتي مباشرة من المتجر:* 👇\n`}
                        <span style={{ color: "#53bdeb", textDecoration: "underline" }}>
                          https://terra-hop-production.up.railway.app/shop/{prod.slug}
                        </span>
                        {`\n\nنتمنى تنورنا دايماً في TERRA HOP! 🖤`}
                      </div>

                      <div style={{ textAlign: "left", fontSize: "10px", color: "#8696a0", marginTop: "6px" }}>
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
