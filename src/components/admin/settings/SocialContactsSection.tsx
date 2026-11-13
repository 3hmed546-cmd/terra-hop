"use client";

import { useEffect, useState } from "react";
import {
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { TikTokIcon, InstagramIcon, FacebookIcon, WhatsAppIcon } from "@/components/ui/social-icons";
import { useLive } from "@/lib/use-live";
import { apiFetch } from "@/lib/admin-auth";

export interface FooterContactsState {
  supportEmail: string;
  infoEmail: string;
  phone: string;
  whatsappUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
}

const DEFAULT_FOOTER_CONTACTS: FooterContactsState = {
  supportEmail: "support@terra-hop.com",
  infoEmail: "info@terra-hop.com",
  phone: "",
  whatsappUrl: "https://chat.whatsapp.com/EWcBrybFmbr7jbMJUJGSUk?s=sh&p=a&iam=2",
  instagramUrl: "https://www.instagram.com/terr3hop/",
  facebookUrl: "https://www.facebook.com/terrahop.wear",
  tiktokUrl: "https://www.tiktok.com/@terr3hop",
};

export function SocialContactsSection() {
  const { data: liveSite } = useLive("settings");
  const [form, setForm] = useState<FooterContactsState>(DEFAULT_FOOTER_CONTACTS);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Sync with live database setting
  useEffect(() => {
    const contacts = liveSite?.settings?.store?.footer_contacts;
    if (contacts) {
      setForm({
        supportEmail: contacts.supportEmail ?? DEFAULT_FOOTER_CONTACTS.supportEmail,
        infoEmail: contacts.infoEmail ?? DEFAULT_FOOTER_CONTACTS.infoEmail,
        phone: contacts.phone ?? "",
        whatsappUrl: contacts.whatsappUrl || DEFAULT_FOOTER_CONTACTS.whatsappUrl,
        instagramUrl: contacts.instagramUrl || DEFAULT_FOOTER_CONTACTS.instagramUrl,
        facebookUrl: contacts.facebookUrl || DEFAULT_FOOTER_CONTACTS.facebookUrl,
        tiktokUrl: contacts.tiktokUrl || DEFAULT_FOOTER_CONTACTS.tiktokUrl,
      });
    }
  }, [liveSite]);

  const patch = (p: Partial<FooterContactsState>) => {
    setForm((prev) => ({ ...prev, ...p }));
  };

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await apiFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupKey: "store",
          key: "footer_contacts",
          value: {
            ...form,
            supportEmail: form.supportEmail.trim(),
            infoEmail: form.infoEmail.trim(),
            phone: form.phone.trim(),
            whatsappUrl: form.whatsappUrl.trim(),
            instagramUrl: form.instagramUrl.trim(),
            facebookUrl: form.facebookUrl.trim(),
            tiktokUrl: form.tiktokUrl.trim(),
            updatedAt: new Date().toISOString(),
          },
        }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok || !payload.ok) {
        throw new Error(payload?.error?.message || payload?.error || "فشل حفظ بيانات الفوتر والتواصل.");
      }

      setStatusMessage({
        type: "success",
        text: "تم حفظ روابط السوشيال ميديا وبيانات التواصل بنجاح! تم تحديث الفوتر لحظياً في كامل الموقع.",
      });
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err?.message || "حدث خطأ أثناء حفظ الإعدادات.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 pt-2">
      {/* 1. Header Information */}
      <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 sm:p-5">
        <h3 className="font-bold text-base text-off-white flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-concrete" />
          روابط السوشيال ميديا وأرقام وإيميلات التواصل (فوتر الموقع)
        </h3>
        <p className="text-xs text-concrete mt-1 leading-relaxed">
          أي تعديل تقوم به هنا ينعكس في نفس اللحظة عبر البث المباشر (SSE) على فوتر المتجر في جميع الصفحات، دون الحاجة لإعادة تحميل الموقع.
        </p>
      </div>

      {/* 2. Social Media Links */}
      <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 sm:p-5 space-y-4">
        <h4 className="font-semibold text-sm text-off-white">حسابات التواصل الاجتماعي (أيقونات الفوتر)</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* TikTok */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-off-white flex items-center gap-2">
              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white text-black p-0.5">
                <TikTokIcon className="w-3.5 h-3.5 fill-black" />
              </span>
              رابط حساب تيك توك (TikTok)
            </label>
            <div className="relative">
              <input
                type="url"
                value={form.tiktokUrl}
                onChange={(e) => patch({ tiktokUrl: e.target.value })}
                placeholder="https://www.tiktok.com/@terr3hop"
                dir="ltr"
                className="w-full bg-obsidian border border-white/20 rounded-lg px-3 py-2 text-off-white text-xs font-mono focus:outline-none focus:border-white transition-colors pl-8"
              />
              {form.tiktokUrl && (
                <a
                  href={form.tiktokUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-concrete hover:text-white"
                  title="فتح الرابط للتجربة"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          {/* Instagram */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-off-white flex items-center gap-2">
              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white text-black p-0.5">
                <InstagramIcon className="w-3.5 h-3.5" />
              </span>
              رابط حساب إنستغرام (Instagram)
            </label>
            <div className="relative">
              <input
                type="url"
                value={form.instagramUrl}
                onChange={(e) => patch({ instagramUrl: e.target.value })}
                placeholder="https://www.instagram.com/terr3hop/"
                dir="ltr"
                className="w-full bg-obsidian border border-white/20 rounded-lg px-3 py-2 text-off-white text-xs font-mono focus:outline-none focus:border-white transition-colors pl-8"
              />
              {form.instagramUrl && (
                <a
                  href={form.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-concrete hover:text-white"
                  title="فتح الرابط للتجربة"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          {/* Facebook */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-off-white flex items-center gap-2">
              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white text-black p-0.5">
                <FacebookIcon className="w-3.5 h-3.5" />
              </span>
              رابط صفحة فيسبوك (Facebook)
            </label>
            <div className="relative">
              <input
                type="url"
                value={form.facebookUrl}
                onChange={(e) => patch({ facebookUrl: e.target.value })}
                placeholder="https://www.facebook.com/terrahop.wear"
                dir="ltr"
                className="w-full bg-obsidian border border-white/20 rounded-lg px-3 py-2 text-off-white text-xs font-mono focus:outline-none focus:border-white transition-colors pl-8"
              />
              {form.facebookUrl && (
                <a
                  href={form.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-concrete hover:text-white"
                  title="فتح الرابط للتجربة"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          {/* WhatsApp */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-off-white flex items-center gap-2">
              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white text-black p-0.5">
                <WhatsAppIcon className="w-3.5 h-3.5" />
              </span>
              رابط مجتمع أو جروب واتساب (WhatsApp Group)
            </label>
            <div className="relative">
              <input
                type="url"
                value={form.whatsappUrl}
                onChange={(e) => patch({ whatsappUrl: e.target.value })}
                placeholder="https://chat.whatsapp.com/..."
                dir="ltr"
                className="w-full bg-obsidian border border-white/20 rounded-lg px-3 py-2 text-off-white text-xs font-mono focus:outline-none focus:border-white transition-colors pl-8"
              />
              {form.whatsappUrl && (
                <a
                  href={form.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-concrete hover:text-white"
                  title="فتح الرابط للتجربة"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Direct Contact Details (Emails & Phone) */}
      <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 sm:p-5 space-y-4">
        <h4 className="font-semibold text-sm text-off-white">بيانات التواصل المباشر (تظهر في عمود Contact بالفوتر)</h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Support Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-off-white flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-concrete" />
              إيميل الدعم الفني والطلبات
            </label>
            <input
              type="email"
              value={form.supportEmail}
              onChange={(e) => patch({ supportEmail: e.target.value })}
              placeholder="support@terra-hop.com"
              dir="ltr"
              className="w-full bg-obsidian border border-white/20 rounded-lg px-3 py-2 text-off-white text-xs font-mono focus:outline-none focus:border-white transition-colors"
            />
          </div>

          {/* Info Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-off-white flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-concrete" />
              إيميل الاستفسارات العامة
            </label>
            <input
              type="email"
              value={form.infoEmail}
              onChange={(e) => patch({ infoEmail: e.target.value })}
              placeholder="info@terra-hop.com"
              dir="ltr"
              className="w-full bg-obsidian border border-white/20 rounded-lg px-3 py-2 text-off-white text-xs font-mono focus:outline-none focus:border-white transition-colors"
            />
          </div>

          {/* Phone Number */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-off-white flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-concrete" />
              رقم الهاتف للتواصل (اختياري)
            </label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => patch({ phone: e.target.value })}
              placeholder="+20 128 569 4670 (اتركه فارغاً للإخفاء)"
              dir="ltr"
              className="w-full bg-obsidian border border-white/20 rounded-lg px-3 py-2 text-off-white text-xs font-mono focus:outline-none focus:border-white transition-colors"
            />
            <p className="text-[11px] text-concrete">
              عند كتابة رقم هاتف، يظهر فورياً في الفوتر كزر اتصال قابل للنقر. وإذا تركته فارغاً يختفي تماماً.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Live Footer Preview Mini Card */}
      <div className="bg-black/60 border border-white/10 rounded-xl p-4 text-xs space-y-3">
        <span className="text-concrete block font-medium">معاينة مباشرة لشكل البيانات في الفوتر:</span>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-lg bg-obsidian border border-white/5">
          <div className="space-y-1 font-mono text-concrete">
            {form.supportEmail && <div className="text-off-white">{form.supportEmail}</div>}
            {form.infoEmail && <div className="text-off-white">{form.infoEmail}</div>}
            {form.phone && <div className="text-emerald-400 font-semibold">{form.phone}</div>}
          </div>
          <div className="flex items-center gap-3">
            {form.whatsappUrl && (
              <span className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center" title="WhatsApp">
                <WhatsAppIcon className="w-4 h-4 fill-black" />
              </span>
            )}
            {form.instagramUrl && (
              <span className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center" title="Instagram">
                <InstagramIcon className="w-4 h-4" />
              </span>
            )}
            {form.facebookUrl && (
              <span className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center" title="Facebook">
                <FacebookIcon className="w-4 h-4" />
              </span>
            )}
            {form.tiktokUrl && (
              <span className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center" title="TikTok">
                <TikTokIcon className="w-4 h-4 fill-black" />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 5. Save Action Button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-off-white text-obsidian font-bold text-sm hover:bg-white transition-colors cursor-pointer disabled:opacity-50 shadow-md"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          حفظ روابط السوشيال والتواصل
        </button>

        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/20 text-xs font-semibold text-off-white hover:bg-white/5 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          معاينة الفوتر على الموقع الحي ↗
        </a>
      </div>

      {/* Status feedback message */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-lg flex items-center gap-2.5 text-xs ${
            statusMessage.type === "success"
              ? "bg-emerald-950/40 border border-emerald-500/30 text-emerald-300"
              : "bg-rose-950/40 border border-rose-500/30 text-rose-300"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}
    </form>
  );
}
