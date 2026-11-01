"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TextInput } from "@/components/ui/text-input";
import { uiStrings } from "@/lib/ui-strings";
import { login } from "@/lib/admin-auth";
import { adminHref } from "@/lib/admin/paths";

const t = uiStrings.adminLogin;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const ERR = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
const NET = "حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.";
const LOCK = "محاولات كثيرة خاطئة. يرجى الانتظار قليلاً ثم المحاولة.";

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
      setError(LOCK);
      setWait(r.retryAfter ?? 60);
    } else {
      setError(r.status === 401 ? ERR : NET);
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
            {/* Email Field */}
            <div>
              <Label
                htmlFor="admin-email"
                className={hasError ? "text-red-600 font-bold" : isSuccess ? "text-emerald-700 font-bold" : undefined}
                style={{ color: hasError ? "#DC2626" : isSuccess ? "#16A34A" : undefined }}
              >
                {t.emailLabel}
              </Label>
              <div className="relative mt-2">
                <TextInput
                  id="admin-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={uiStrings.form.emailPlaceholder}
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
              <Label
                htmlFor="admin-password"
                className={hasError ? "text-red-600 font-bold" : isSuccess ? "text-emerald-700 font-bold" : undefined}
                style={{ color: hasError ? "#DC2626" : isSuccess ? "#16A34A" : undefined }}
              >
                {t.passwordLabel}
              </Label>
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
                  <span>Verifying…</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <span>Verified</span>
                </>
              ) : wait > 0 ? (
                <span>
                  Try again in {Math.floor(wait / 60)}:
                  {String(wait % 60).padStart(2, "0")}
                </span>
              ) : (
                <span>{t.submit}</span>
              )}
            </Button>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
