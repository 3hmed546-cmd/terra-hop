"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Loader2, AlertCircle, CheckCircle2, KeyRound, Mail, ArrowRight, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TextInput } from "@/components/ui/text-input";
import { uiStrings } from "@/lib/ui-strings";
import { login } from "@/lib/admin-auth";
import { adminHref } from "@/lib/admin/paths";

const t = uiStrings.adminLogin;
const emailPattern = /^([^\s@]+@[^\s@]+\.[^\s@]{2,}|admin|[a-zA-Z0-9_-]{3,})$/i;

const ERR = "البريد الإلكتروني أو اسم المستخدم أو كلمة المرور غير صحيحة.";
const NET = "حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.";
const LOCK = "تم حظر محاولات تسجيل الدخول مؤقتاً لمدة 20 دقيقة لحماية الحساب.";

export function LoginForm() {
  const router = useRouter();
  const reduce = useReducedMotion();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [wait, setWait] = useState(0); // Retry-After countdown in seconds
  const [shake, setShake] = useState(0);

  // Forgot Password Modal State
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3 | 4>(1);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotResetToken, setForgotResetToken] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotShowPass, setForgotShowPass] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000);
    return () => clearInterval(timer);
  }, [wait]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading || wait > 0 || isSuccess) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !emailPattern.test(trimmedEmail)) {
      setError(t.emailError);
      setShake((n) => n + 1);
      return;
    }

    if (!password) {
      setError(t.passwordError);
      setShake((n) => n + 1);
      return;
    }

    setLoading(true);
    setError(null);

    const r = await login(trimmedEmail, password);
    setLoading(false);

    if (r.ok) {
      setIsSuccess(true);
      setError(null);

      // Transition to loading indicator
      setTimeout(() => {
        setIsRedirecting(true);
      }, 550);

      // Redirect to admin dashboard
      setTimeout(() => {
        router.replace(adminHref("/dashboard"));
      }, 1500);
      return;
    }

    if (r.status === 429) {
      setError(r.error || LOCK);
      setWait(r.retryAfter ?? 1200);
    } else if (r.status === 401) {
      setError(r.error || ERR);
    } else {
      setError(r.error || NET);
    }
    setShake((n) => n + 1);
  }

  function handleEmailChange(val: string) {
    setEmail(val);
    if (error) setError(null);
  }

  function handlePasswordChange(val: string) {
    setPassword(val);
    if (error) setError(null);
  }

  // --- Forgot Password Handlers ---
  function openForgotPassword() {
    setForgotEmail(email.includes("@") ? email.trim() : "");
    setForgotOtp("");
    setForgotNewPassword("");
    setForgotConfirmPassword("");
    setForgotError(null);
    setForgotStep(1);
    setForgotOpen(true);
  }

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail || !forgotEmail.includes("@")) {
      setForgotError("يرجى إدخال بريد إلكتروني صالح.");
      return;
    }
    setForgotLoading(true);
    setForgotError(null);

    try {
      const res = await fetch("/api/admin/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_otp", email: forgotEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error?.message || data?.error || "فشل إرسال رمز التحقق.");
      }
      setForgotStep(2);
    } catch (err: any) {
      setForgotError(err?.message || "حدث خطأ أثناء إرسال الرمز.");
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotOtp || forgotOtp.trim().length !== 6) {
      setForgotError("يرجى إدخال رمز التحقق المكون من 6 أرقام.");
      return;
    }
    setForgotLoading(true);
    setForgotError(null);

    try {
      const res = await fetch("/api/admin/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_otp",
          email: forgotEmail.trim(),
          otp: forgotOtp.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error?.message || data?.error || "رمز التحقق غير صحيح.");
      }
      setForgotResetToken(data.data.resetToken);
      setForgotStep(3);
    } catch (err: any) {
      setForgotError(err?.message || "رمز التحقق غير صحيح.");
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (forgotNewPassword.length < 8) {
      setForgotError("يجب ألا تقل كلمة المرور الجديدة عن 8 أحرف.");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError("كلمتا المرور غير متطابقتين.");
      return;
    }
    setForgotLoading(true);
    setForgotError(null);

    try {
      const res = await fetch("/api/admin/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_password",
          email: forgotEmail.trim(),
          resetToken: forgotResetToken,
          newPassword: forgotNewPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error?.message || data?.error || "فشل تحديث كلمة المرور.");
      }
      setForgotStep(4);
      setEmail(forgotEmail);
      setPassword("");
    } catch (err: any) {
      setForgotError(err?.message || "حدث خطأ أثناء تحديث كلمة المرور.");
    } finally {
      setForgotLoading(false);
    }
  }

  const hasError = !!error;

  return (
    <motion.div
      key={shake}
      animate={shake && !reduce ? { x: [0, -9, 9, -7, 7, -4, 4, 0] } : undefined}
      transition={{ duration: 0.4 }}
      className="mt-8"
    >
      <AnimatePresence mode="wait">
        {isRedirecting ? (
          /* Loading indicator replacing form on successful login */
          <motion.div
            key="redirecting-screen"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="py-12 flex flex-col items-center justify-center text-center border border-line-light bg-white rounded-control p-8"
          >
            <div className="relative mb-4">
              <div
                className="h-12 w-12 rounded-full border-2 animate-spin"
                style={{ borderColor: "rgba(8, 8, 8, 0.15)", borderTopColor: "#080808" }}
              />
              <CheckCircle2
                size={22}
                className="absolute inset-0 m-auto"
                style={{ color: "#16A34A" }}
                aria-hidden="true"
              />
            </div>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-obsidian">
              تم تأكيد الدخول بنجاح
            </p>
            <p className="text-xs text-graphite mt-1.5">
              جاري الانتقال إلى لوحة التحكم…
            </p>
          </motion.div>
        ) : (
          /* Login Form */
          <motion.form
            key="login-form-content"
            noValidate
            onSubmit={onSubmit}
            className="space-y-6"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {/* Email / Username Field */}
            <div>
              <Label
                htmlFor="admin-email"
                className={hasError ? "text-red-600 font-bold" : isSuccess ? "text-emerald-700 font-bold" : undefined}
                style={{ color: hasError ? "#DC2626" : isSuccess ? "#16A34A" : undefined }}
              >
                البريد الإلكتروني أو اسم المستخدم
              </Label>
              <div className="relative mt-2">
                <TextInput
                  id="admin-email"
                  name="email"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="admin أو الإيميل الخاص بك"
                  disabled={isSuccess || loading}
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  error={hasError}
                  aria-describedby={hasError ? "admin-auth-error" : undefined}
                  style={
                    hasError
                      ? { borderColor: "#DC2626", backgroundColor: "#FEF2F2", color: "#991B1B" }
                      : isSuccess
                      ? { borderColor: "#16A34A", backgroundColor: "#F0FDF4", color: "#14532D" }
                      : undefined
                  }
                />
                {isSuccess && (
                  <CheckCircle2
                    size={18}
                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: "#16A34A" }}
                    aria-hidden="true"
                  />
                )}
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="admin-password"
                  className={hasError ? "text-red-600 font-bold" : isSuccess ? "text-emerald-700 font-bold" : undefined}
                  style={{ color: hasError ? "#DC2626" : isSuccess ? "#16A34A" : undefined }}
                >
                  {t.passwordLabel}
                </Label>
                <button
                  type="button"
                  onClick={openForgotPassword}
                  className="text-xs text-neutral-500 hover:text-black font-semibold hover:underline cursor-pointer transition-colors"
                >
                  نسيت كلمة السر؟
                </button>
              </div>

              <div className="relative mt-2">
                <TextInput
                  id="admin-password"
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  className={isSuccess ? "pr-12" : "pr-20"}
                  disabled={isSuccess || loading}
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  error={hasError}
                  aria-describedby={hasError ? "admin-auth-error" : undefined}
                  style={
                    hasError
                      ? { borderColor: "#DC2626", backgroundColor: "#FEF2F2", color: "#991B1B" }
                      : isSuccess
                      ? { borderColor: "#16A34A", backgroundColor: "#F0FDF4", color: "#14532D" }
                      : undefined
                  }
                />
                {isSuccess ? (
                  <CheckCircle2
                    size={18}
                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: "#16A34A" }}
                    aria-hidden="true"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-pressed={show}
                    aria-controls="admin-password"
                    className="text-label absolute inset-y-0 right-0 flex min-w-16 items-center justify-center px-3 hover:underline cursor-pointer"
                    style={{ color: hasError ? "#DC2626" : undefined }}
                  >
                    {show ? t.hidePassword : t.showPassword}
                  </button>
                )}
              </div>
            </div>

            {/* Red Alert Banner on Error */}
            <div aria-live="assertive">
              <AnimatePresence>
                {error && (
                  <motion.div
                    id="admin-auth-error"
                    role="alert"
                    initial={reduce ? false : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-3.5 rounded-control flex items-center gap-2.5 text-xs font-semibold"
                    style={{
                      border: "1.5px solid #DC2626",
                      backgroundColor: "#FEF2F2",
                      color: "#DC2626",
                    }}
                  >
                    <AlertCircle
                      size={17}
                      className="shrink-0"
                      style={{ color: "#DC2626", stroke: "#DC2626" }}
                      aria-hidden="true"
                    />
                    <span style={{ color: "#DC2626", fontWeight: 600 }}>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full flex items-center justify-center gap-2 cursor-pointer transition-colors"
              disabled={loading || wait > 0 || isSuccess}
              aria-busy={loading}
              style={
                isSuccess
                  ? { backgroundColor: "#16A34A", color: "#FFFFFF" }
                  : undefined
              }
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  <span>جاري التحقق…</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <span>تم الدخول بنجاح</span>
                </>
              ) : wait > 0 ? (
                <span>
                  حاول مجدداً بعد {Math.floor(wait / 60)}:
                  {String(wait % 60).padStart(2, "0")}
                </span>
              ) : (
                <span>{t.submit}</span>
              )}
            </Button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* FORGOT PASSWORD MODAL (Brevo OTP & Rate Limited) */}
      {/* ============================================================== */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white border border-neutral-300 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 text-neutral-900">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <h3 className="font-bold text-base sm:text-lg flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-neutral-800" />
                استعادة كلمة المرور
              </h3>
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                className="text-neutral-400 hover:text-black font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {forgotError && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-300 text-red-900 text-xs font-semibold flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{forgotError}</span>
              </div>
            )}

            {/* STEP 1: Enter Email */}
            {forgotStep === 1 && (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <p className="text-xs text-neutral-600 leading-relaxed">
                  أدخل البريد الإلكتروني المسجل لحساب المسؤول، وسنرسل لك رمز تحقق سري (OTP) عبر البريد لتأكيد هويتك.
                </p>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-neutral-800">
                    البريد الإلكتروني *
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      dir="ltr"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="admin@terra-hop.com"
                      className="w-full bg-white border border-neutral-300 rounded-lg px-3.5 py-2 pl-9 text-xs sm:text-sm text-neutral-900 font-mono focus:outline-none focus:border-black focus:ring-1 focus:ring-black shadow-xs"
                    />
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotOpen(false)}
                    className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 text-xs font-bold hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-neutral-900 hover:bg-black text-white text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    إرسال رمز التحقق (OTP)
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: Enter 6-digit OTP */}
            {forgotStep === 2 && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-xs text-neutral-700 space-y-1">
                  <div>تم إرسال رمز التحقق إلى: <strong className="font-mono">{forgotEmail}</strong></div>
                  <div className="text-[11px] text-neutral-500">⏱️ الرمز صالح لمدة 15 دقيقة. الحد الأقصى 5 محاولات قبل حظر الحساب مؤقتاً.</div>
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
                    value={forgotOtp}
                    onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                    className="w-full bg-white border-2 border-neutral-900 rounded-lg px-4 py-2.5 text-center text-2xl font-mono tracking-[0.4em] font-extrabold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-black shadow-xs"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="text-xs text-neutral-500 hover:text-black font-semibold underline cursor-pointer"
                  >
                    تغيير الإيميل
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading || forgotOtp.length !== 6}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-neutral-900 hover:bg-black text-white text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    تأكيد رمز التحقق
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Enter New Password */}
            {forgotStep === 3 && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-xs text-neutral-600 leading-relaxed">
                  تم تأكيد هويتك بنجاح! أدخل الآن كلمة المرور الجديدة لحسابك:
                </p>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-neutral-800">
                    كلمة المرور الجديدة *
                  </label>
                  <div className="relative">
                    <input
                      type={forgotShowPass ? "text" : "password"}
                      required
                      minLength={8}
                      dir="ltr"
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="8 أحرف على الأقل..."
                      className="w-full bg-white border border-neutral-300 rounded-lg px-3.5 py-2 pl-9 text-xs sm:text-sm text-neutral-900 font-mono focus:outline-none focus:border-black focus:ring-1 focus:ring-black shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setForgotShowPass(!forgotShowPass)}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black p-1 cursor-pointer"
                    >
                      {forgotShowPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    placeholder="أعد كتابة كلمة المرور..."
                    className="w-full bg-white border border-neutral-300 rounded-lg px-3.5 py-2 text-xs sm:text-sm text-neutral-900 font-mono focus:outline-none focus:border-black focus:ring-1 focus:ring-black shadow-xs"
                  />
                </div>

                <p className="text-[11px] text-neutral-500">
                  🔒 سيتم تشفير كلمة المرور فورياً بمعيار Supabase Bcrypt ($2b$10$) المشفر.
                </p>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-neutral-900 hover:bg-black text-white text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    تعيين كلمة المرور الجديدة
                  </button>
                </div>
              </form>
            )}

            {/* STEP 4: Success confirmation */}
            {forgotStep === 4 && (
              <div className="text-center py-4 space-y-4">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-neutral-900">تم تحديث كلمة المرور بنجاح!</h4>
                  <p className="text-xs text-neutral-600 mt-1">
                    يمكنك الآن تسجيل الدخول مباشرة بكلمة المرور الجديدة.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  className="w-full px-5 py-2.5 rounded-lg bg-neutral-900 hover:bg-black text-white text-xs sm:text-sm font-bold shadow-sm transition-colors cursor-pointer"
                >
                  العودة لتسجيل الدخول
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
