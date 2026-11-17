"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  Smartphone,
  Clock,
  KeyRound,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
} from "lucide-react";
import { logout } from "@/lib/admin-auth";
import { adminHref } from "@/lib/admin/paths";

export interface SupersededInfo {
  summary: string;
  time: string;
  date: string;
  userEmail?: string;
}

interface SessionSupersededModalProps {
  info: SupersededInfo;
}

export function SessionSupersededModal({ info }: SessionSupersededModalProps) {
  const router = useRouter();

  // Wizard view: "notice" (default screen), or "recovery" (change password via Brevo OTP)
  const [view, setView] = useState<"notice" | "recovery">("notice");
  const [recoveryStep, setRecoveryStep] = useState<1 | 2 | 3 | 4>(1);

  const [email, setEmail] = useState(info.userEmail || "");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);

  // 1. "هذا أنا" (This was me) -> Logout and take to login page cleanly
  async function handleThisIsMe() {
    setLoading(true);
    try {
      await logout();
    } catch {}
    router.replace(adminHref("/dashboard"));
  }

  // 2. Brevo OTP flow
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("يرجى إدخال بريد إلكتروني صالح.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_otp", email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error?.message || data?.error || "فشل إرسال رمز التحقق.");
      }
      setRecoveryStep(2);
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء إرسال الرمز.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp || otp.trim().length !== 6) {
      setError("يرجى إدخال رمز التحقق المكون من 6 أرقام.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify_otp", email: email.trim(), otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error?.message || data?.error || "رمز التحقق غير صحيح.");
      }
      setResetToken(data.data.resetToken);
      setRecoveryStep(3);
    } catch (err: any) {
      setError(err?.message || "رمز التحقق غير صحيح.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPasswordAndRevokeAll(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError("يجب ألا تقل كلمة المرور الجديدة عن 8 أحرف.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_password",
          email: email.trim(),
          resetToken,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error?.message || data?.error || "فشل تغيير كلمة المرور.");
      }
      setRecoveryStep(4);
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء حفظ كلمة المرور.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white border border-neutral-300 rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl text-neutral-900 space-y-6 text-center" dir="rtl">
        {/* ============================================================== */}
        {/* VIEW 1: NOTICE SCREEN (هذا أنا vs تغيير كلمة السر) */}
        {/* ============================================================== */}
        {view === "notice" && (
          <div className="space-y-6">
            {/* Warning Shield Icon with Pulse */}
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-red-100 animate-ping opacity-75" />
              <div className="relative w-16 h-16 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg">
                <ShieldAlert className="w-8 h-8" />
              </div>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black text-neutral-900">
                تم فتح الحساب من جهاز آخر
              </h2>
              <p className="text-xs sm:text-sm text-neutral-600 mt-2 leading-relaxed">
                تم تسجيل الدخول إلى هذا الحساب من هاتف/متصفح آخر.<br />
                تم إنهاء الجلسة على هذا الجهاز فورياً لحماية الحساب ومنع الاستخدام المتزامن.
              </p>
            </div>

            {/* Device Info Card */}
            <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 text-right space-y-2.5 text-xs sm:text-sm">
              <div className="text-xs font-bold text-neutral-500 mb-1 border-b border-neutral-200 pb-1.5">
                تفاصيل الجهاز الجديد الذي فتح الحساب:
              </div>
              <div className="flex items-center gap-2 text-neutral-800">
                <Smartphone className="w-4 h-4 text-neutral-500 shrink-0" />
                <span><strong>الجهاز:</strong> {info.summary}</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-800">
                <Clock className="w-4 h-4 text-neutral-500 shrink-0" />
                <span><strong>التوقيت:</strong> {info.time} | {info.date}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {/* Option 1: هذا أنا */}
              <button
                type="button"
                onClick={handleThisIsMe}
                disabled={loading}
                className="flex-1 py-3 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-bold text-xs sm:text-sm transition-colors cursor-pointer border border-neutral-300 flex items-center justify-center gap-2 shadow-xs"
              >
                <LogOut className="w-4 h-4" />
                هذا أنا (أنا من فتح الحساب)
              </button>

              {/* Option 2: تغيير كلمة السر */}
              <button
                type="button"
                onClick={() => setView("recovery")}
                disabled={loading}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md"
              >
                <KeyRound className="w-4 h-4" />
                تغيير كلمة السر (لست أنا)
              </button>
            </div>

            <p className="text-[11px] text-neutral-400">
              🔒 نظام حماية الجلسة الموحدة (Single Active Session) — TERRA HOP Security
            </p>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW 2: RECOVERY WIZARD (Brevo OTP & Change Password) */}
        {/* ============================================================== */}
        {view === "recovery" && (
          <div className="space-y-5 text-right">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 className="font-bold text-base sm:text-lg flex items-center gap-2 text-neutral-900">
                <KeyRound className="w-5 h-5 text-red-600" />
                تأمين الحساب وتغيير كلمة السر
              </h3>
              <button
                type="button"
                onClick={() => setView("notice")}
                className="text-xs text-neutral-500 hover:text-black font-semibold"
              >
                رجوع
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs font-semibold flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {/* STEP 1: Request OTP */}
            {recoveryStep === 1 && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <p className="text-xs text-neutral-600 leading-relaxed">
                  سنرسل لك رمز تحقق سري (OTP) إلى بريدك الإلكتروني عبر <strong>support@terra-hop.com</strong> لتأكيد هويتك وطرد الجهاز المخترق فوراً.
                </p>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-neutral-800">
                    البريد الإلكتروني المسجل *
                  </label>
                  <input
                    type="email"
                    required
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="manager@terra-hop.com"
                    className="w-full bg-white border border-neutral-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono text-neutral-900 focus:outline-none focus:border-black focus:ring-1 focus:ring-black shadow-xs"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-black text-white font-bold text-xs sm:text-sm shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    إرسال رمز التحقق OTP
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: Verify OTP */}
            {recoveryStep === 2 && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-700 space-y-1">
                  <div>تم إرسال كود التحقق من <strong>support@terra-hop.com</strong> إلى: <strong className="font-mono">{email}</strong></div>
                  <div className="text-[11px] text-neutral-500">⏱️ الرمز صالح لمدة 15 دقيقة (5 محاولات كحد أقصى).</div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-neutral-800 text-center">
                    أدخل رمز التحقق (6 أرقام) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    dir="ltr"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                    className="w-full bg-white border-2 border-neutral-900 rounded-xl px-4 py-2.5 text-center text-2xl font-mono tracking-[0.4em] font-extrabold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-black shadow-xs"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || otp.length !== 6}
                    className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-black text-white font-bold text-xs sm:text-sm shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    تأكيد رمز التحقق
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: New Password */}
            {recoveryStep === 3 && (
              <form onSubmit={handleResetPasswordAndRevokeAll} className="space-y-4">
                <p className="text-xs text-neutral-600 leading-relaxed">
                  تم تأكيد هويتك بنجاح! أدخل كلمة المرور الجديدة لحسابك:
                </p>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-neutral-800">
                    كلمة المرور الجديدة *
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      required
                      minLength={8}
                      dir="ltr"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="8 أحرف على الأقل..."
                      className="w-full bg-white border border-neutral-300 rounded-xl px-3.5 py-2.5 pl-9 text-xs sm:text-sm font-mono text-neutral-900 focus:outline-none focus:border-black focus:ring-1 focus:ring-black shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black p-1 cursor-pointer"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-neutral-800">
                    تأكيد كلمة المرور الجديدة *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    dir="ltr"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="أعد كتابة كلمة المرور..."
                    className="w-full bg-white border border-neutral-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono text-neutral-900 focus:outline-none focus:border-black focus:ring-1 focus:ring-black shadow-xs"
                  />
                </div>

                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-950 font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-red-600" />
                  <span>سيتم تسجيل الخروج فورياً من كافة الأجهزة وحظر الجهاز الآخر.</span>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    حفظ وتسجيل الخروج من كافة الأجهزة
                  </button>
                </div>
              </form>
            )}

            {/* STEP 4: Success confirmation */}
            {recoveryStep === 4 && (
              <div className="text-center py-4 space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center shadow-xs">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-neutral-900">تم تأمين حسابك بنجاح!</h4>
                  <p className="text-xs text-neutral-600 mt-1">
                    تم تغيير كلمة المرور وتسجيل الخروج من كافة الأجهزة والهواتف الأخرى في نفس اللحظة.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleThisIsMe}
                  className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-black text-white font-bold text-xs sm:text-sm shadow-md transition-colors cursor-pointer"
                >
                  الانتقال لتسجيل الدخول بكلمة المرور الجديدة
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
