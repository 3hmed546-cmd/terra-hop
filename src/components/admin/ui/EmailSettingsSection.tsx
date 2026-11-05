"use client";

import { useEffect, useState } from "react";
import { Mail, Send, CheckCircle2, AlertCircle, Loader2, Key, Info, ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/admin-auth";
import { Button, useToast } from "./";

export function EmailSettingsSection() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [brevoApiKey, setBrevoApiKey] = useState("");
  const [senderEmail, setSenderEmail] = useState("terr3hop@gmail.com");
  const [hasBrevo, setHasBrevo] = useState(false);
  const [testEmail, setTestEmail] = useState("terr3hop@gmail.com");
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
        setBrevoApiKey(d.brevoApiKey || "");
        setSenderEmail(d.senderEmail || "terr3hop@gmail.com");
        setHasBrevo(d.hasBrevo);
        setTestEmail(d.senderEmail || "terr3hop@gmail.com");
      }
    } catch {}
    setLoading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!brevoApiKey) {
      setStatusMsg({ type: "error", text: "يرجى كتابة أو لصق مفتاح Brevo API Key أولاً." });
      return;
    }

    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await apiFetch("/api/admin/email/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brevoApiKey, senderEmail }),
      });
      const json = await res.json();
      if (json.ok) {
        toast.push("تم حفظ مفتاح Brevo بنجاح.");
        setStatusMsg({
          type: "success",
          text: "تم حفظ إعدادات Brevo بنجاح! يمكنك الآن تجربة إرسال إيميل للتأكد من وصوله فوراً.",
        });
        loadSettings();
      } else {
        setStatusMsg({ type: "error", text: json.error?.message || "فشل حفظ مفتاح Brevo." });
      }
    } catch {
      setStatusMsg({ type: "error", text: "تعذر الاتصال بالخادم." });
    }
    setSaving(false);
  }

  async function handleTestSend() {
    if (!testEmail) {
      setStatusMsg({ type: "error", text: "يرجى كتابة البريد الإلكتروني لتجربة الاستلام." });
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
        setStatusMsg({
          type: "success",
          text: `وصل الإيميل التجريبي بنجاح عبر Brevo إلى ${testEmail}! تفقد صندوق الوارد.`,
        });
        toast.push("تم إرسال إيميل التجربة بنجاح!");
      } else {
        setStatusMsg({ type: "error", text: json.error?.message || "فشل إرسال الإيميل التجريبي." });
      }
    } catch {
      setStatusMsg({ type: "error", text: "حدث خطأ أثناء الاتصال بالخادم." });
    }
    setTesting(false);
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-3">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-obsidian" />
          <span className="font-bold text-sm">نظام إرسال الفواتير وتأكيد الطلبات (Brevo API)</span>
        </div>
        <div>
          {hasBrevo ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              مفعّل وجاهز للإرسال (300 رسالة يومياً مجاناً)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              بانتظار إدخال مفتاح Brevo API Key
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-stone-50 border border-stone-200 p-4 text-xs text-stone-700 space-y-2">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>نظام Brevo السحابي:</strong> يعمل عبر بروتوكول HTTPS المشفر، مما يضمن وصول فواتير الطلبات وروابط التأكيد للعملاء بسرعة فائقة وبدون أي حظر من السيرفر.
            <div className="mt-1">
              <a
                href="https://www.brevo.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline font-bold"
              >
                <span>فتح موقع Brevo لاستخراج المفتاح</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-stone-900 mb-1 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-stone-600" />
            <span>مفتاح Brevo API Key (يبدأ بـ xkeysib-...):</span>
          </label>
          <input
            type="password"
            placeholder="xkeysib-..."
            value={brevoApiKey}
            onChange={(e) => setBrevoApiKey(e.target.value)}
            required
            className="w-full text-xs font-mono p-2.5 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-black bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-900 mb-1">
            إيميل المرسل المسجل في Brevo:
          </label>
          <input
            type="email"
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
            required
            className="w-full text-xs p-2.5 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-black bg-white"
          />
          <p className="text-[11px] text-stone-500 mt-1">
            يجب أن يكون نفس الإيميل الذي أنشأت به الحساب في Brevo (مثال: terr3hop@gmail.com).
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" disabled={saving}>
            {saving ? "جاري الحفظ..." : "حفظ مفتاح Brevo"}
          </Button>
        </div>
      </form>

      {/* Test Section */}
      <div className="mt-6 pt-5 border-t border-stone-200">
        <h4 className="text-xs font-bold text-stone-900 mb-2 flex items-center gap-1.5">
          <Send className="w-3.5 h-3.5 text-stone-700" />
          <span>اختبار إرسال إيميل تجريبي عبر Brevo:</span>
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            placeholder="اكتب إيميلك هنا لتجربة الاستلام"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="flex-1 min-w-[220px] text-xs p-2.5 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-black bg-white"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleTestSend}
            disabled={testing || !hasBrevo}
            title={!hasBrevo ? "يجب حفظ مفتاح Brevo أولاً" : undefined}
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
