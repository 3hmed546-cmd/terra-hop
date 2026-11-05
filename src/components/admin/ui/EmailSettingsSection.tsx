"use client";

import { useEffect, useState } from "react";
import { Mail, Send, CheckCircle2, AlertCircle, Loader2, Link2, Key, Info } from "lucide-react";
import { apiFetch } from "@/lib/admin-auth";
import { Button, TextInput, useToast } from "./";

export function EmailSettingsSection() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [webhookUrl, setWebhookUrl] = useState("");
  const [brevoApiKey, setBrevoApiKey] = useState("");
  const [hasWebhook, setHasWebhook] = useState(false);
  const [hasBrevo, setHasBrevo] = useState(false);
  const [gmailUser, setGmailUser] = useState("terr3hop@gmail.com");
  const [testEmail, setTestEmail] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await apiFetch("/api/admin/email/settings");
      if (res.ok) {
        const json = await res.json();
        const d = json.data;
        setWebhookUrl(d.webhookUrl || "");
        setBrevoApiKey(d.brevoApiKey || "");
        setHasWebhook(d.hasWebhook);
        setHasBrevo(d.hasBrevo);
        setGmailUser(d.gmailUser || "terr3hop@gmail.com");
        setTestEmail(d.gmailUser || "terr3hop@gmail.com");
      }
    } catch {}
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await apiFetch("/api/admin/email/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookUrl, brevoApiKey }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.push("تم حفظ إعدادات إرسال الإيميلات بنجاح.");
        setStatusMsg({ type: "success", text: "تم حفظ الإعدادات بنجاح. يمكنك الآن الضغط على زر التجربة للتأكد من وصول الإيميل." });
        loadSettings();
      } else {
        setStatusMsg({ type: "error", text: json.error?.message || "فشل حفظ الإعدادات." });
      }
    } catch {
      setStatusMsg({ type: "error", text: "تعذر الاتصال بالخادم." });
    }
    setSaving(false);
  }

  async function handleTestSend() {
    if (!testEmail) {
      setStatusMsg({ type: "error", text: "يرجى كتابة البريد الإلكتروني المراد إرسال التجربة إليه." });
      return;
    }

    setTesting(true);
    setStatusMsg(null);
    try {
      const res = await apiFetch("/api/admin/email/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "TEST_EMAIL", to: testEmail }),
      });
      const json = await res.json();
      if (json.ok) {
        setStatusMsg({ type: "success", text: `وصل الإيميل التجريبي بنجاح إلى ${testEmail}! تفقد صندوق الوارد أو البريد غير المرغوب فيه.` });
        toast.push("تم إرسال إيميل التجربة بنجاح!");
      } else {
        setStatusMsg({ type: "error", text: json.error?.message || "فشل إرسال الإيميل التجريبي." });
      }
    } catch {
      setStatusMsg({ type: "error", text: "حدث خطأ أثناء الاتصال بالخادم." });
    }
    setTesting(false);
  }

  const isConfigured = hasWebhook || hasBrevo;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-3">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-obsidian" />
          <span className="font-bold text-sm">نظام إرسال الفواتير وتأكيد الطلبات للعملاء</span>
        </div>
        <div>
          {isConfigured ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              جاهز ومفعّل (HTTPS)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              بانتظار ربط Webhook أو API Key
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-stone-50 border border-stone-200 p-4 text-xs text-stone-700 space-y-2">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <strong>توضيح بخصوص الاستضافة:</strong>
            <p className="mt-1 leading-relaxed text-stone-600">
              سيرفرات الاستضافة السحابية (مثل Railway و Render) تحظر منافذ البريد التقليدية (SMTP Ports 25, 465, 587) لمنع الرسائل العشوائية. 
              لذلك يتم إرسال الإيميلات مجاناً 100% عبر بروتوكول <strong>HTTPS الآمن</strong> باستخدام <strong>Google Apps Script Webhook</strong> من حساب الجيميل الخاص بك مباشرة (<strong>{gmailUser}</strong>) دون أي تكلفة.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-stone-900 mb-1 flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5 text-stone-600" />
            <span>رابط Google Apps Script Webhook (الخيار المجاني الموصى به من الجيميل):</span>
          </label>
          <input
            type="url"
            placeholder="https://script.google.com/macros/s/.../exec"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="w-full text-xs font-mono p-2.5 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-black"
          />
          <p className="text-[11px] text-stone-500 mt-1">
            يتم إنشاء هذا الرابط مجاناً في دقيقة واحدة من داخل حساب {gmailUser} على Google Apps Script.
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-900 mb-1 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-stone-600" />
            <span>أو مفتاح Brevo API Key (خيار بديل مجاني 300 رسالة يومياً):</span>
          </label>
          <input
            type="password"
            placeholder="xkeysib-..."
            value={brevoApiKey}
            onChange={(e) => setBrevoApiKey(e.target.value)}
            className="w-full text-xs font-mono p-2.5 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button type="submit" disabled={saving}>
            {saving ? "جاري الحفظ..." : "حفظ إعدادات الإيميل"}
          </Button>
        </div>
      </form>

      {/* Test Section */}
      <div className="mt-6 pt-5 border-t border-stone-200">
        <h4 className="text-xs font-bold text-stone-900 mb-2 flex items-center gap-1.5">
          <Send className="w-3.5 h-3.5 text-stone-700" />
          <span>اختبار إرسال إيميل تجريبي:</span>
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            placeholder="اكتب إيميلك هنا لتجربة الاستلام"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="flex-1 min-w-[220px] text-xs p-2.5 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-black"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleTestSend}
            disabled={testing}
          >
            {testing ? "جاري الإرسال..." : "إرسال إيميل تجريبي الآن"}
          </Button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`rounded-xl border p-3 text-xs font-bold flex items-center gap-2 ${
            statusMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {statusMsg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}
    </div>
  );
}
