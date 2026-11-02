"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TextInput } from "@/components/ui/text-input";

const RED = "#DC2626";
const GREEN = "#16A34A";

/** Mirrors components/admin/login-form.tsx: same fields, same error/success treatment, same shake. */
export function AmbassadorLoginForm() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [shake, setShake] = useState(0);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading || ok) return;
    if (!id.trim()) { setError("اكتب كود السفير أو بريدك الإلكتروني."); setShake((n) => n + 1); return; }
    if (!password) { setError("اكتب كلمة المرور."); setShake((n) => n + 1); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ambassador/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrCode: id.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(
          res.status === 429
            ? "محاولات كثيرة خاطئة. استنى شوية وجرب تاني."
            : data.message || data.error || "بيانات الدخول غير صحيحة.",
        );
        setShake((n) => n + 1);
        setLoading(false);
        return;
      }
      setOk(true);
      setLoading(false);
      setTimeout(() => router.replace("/ambassador"), 900);
    } catch {
      setError("حدث خطأ في الاتصال. حاول مرة أخرى.");
      setShake((n) => n + 1);
      setLoading(false);
    }
  }

  const fieldStyle = error
    ? { borderColor: RED, backgroundColor: "#FEF2F2", color: "#991B1B" }
    : ok
      ? { borderColor: GREEN, backgroundColor: "#F0FDF4", color: "#14532D" }
      : undefined;
  const labelStyle = { color: error ? RED : ok ? GREEN : undefined };

  return (
    <motion.div
      key={shake}
      animate={shake && !reduce ? { x: [0, -9, 9, -7, 7, -4, 4, 0] } : undefined}
      transition={{ duration: 0.4 }}
      className="mt-8"
    >
      <form noValidate onSubmit={onSubmit} className="space-y-6">
        <div>
          <Label htmlFor="amb-id" style={labelStyle}>كود السفير أو البريد الإلكتروني</Label>
          <TextInput
            id="amb-id"
            name="username"
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck={false}
            dir="ltr"
            placeholder="AHMED10"
            className="mt-2 text-left"
            value={id}
            disabled={loading || ok}
            onChange={(e) => { setId(e.target.value); if (error) setError(null); }}
            error={!!error}
            aria-describedby={error ? "amb-auth-error" : undefined}
            style={fieldStyle}
          />
        </div>

        <div>
          <Label htmlFor="amb-password" style={labelStyle}>كلمة المرور</Label>
          <div className="relative mt-2">
            <TextInput
              id="amb-password"
              name="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              dir="ltr"
              className="pl-20 text-left"
              value={password}
              disabled={loading || ok}
              onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
              error={!!error}
              aria-describedby={error ? "amb-auth-error" : undefined}
              style={fieldStyle}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-pressed={show}
              aria-controls="amb-password"
              className="text-label absolute inset-y-0 left-0 flex min-w-16 cursor-pointer items-center justify-center px-3 hover:underline"
            >
              {show ? "إخفاء" : "إظهار"}
            </button>
          </div>
          <p className="mt-2 text-sm text-graphite">أول مرة؟ كلمة المرور المبدئية هي رقم موبايلك.</p>
        </div>

        <div aria-live="assertive">
          <AnimatePresence>
            {error ? (
              <motion.div
                id="amb-auth-error"
                role="alert"
                initial={reduce ? false : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2.5 rounded-control p-3.5 text-xs font-semibold"
                style={{ border: `1.5px solid ${RED}`, backgroundColor: "#FEF2F2", color: RED }}
              >
                <AlertCircle size={17} className="shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <Button
          type="submit"
          className="flex w-full items-center justify-center gap-2"
          disabled={loading || ok}
          aria-busy={loading}
          style={ok ? { backgroundColor: GREEN, color: "#FFFFFF" } : undefined}
        >
          {loading ? (
            <><Loader2 size={16} className="animate-spin" aria-hidden="true" /><span>جاري التحقق…</span></>
          ) : ok ? (
            <><CheckCircle2 size={16} aria-hidden="true" /><span>تم الدخول</span></>
          ) : (
            <span>دخول البورتال</span>
          )}
        </Button>
      </form>
    </motion.div>
  );
}
