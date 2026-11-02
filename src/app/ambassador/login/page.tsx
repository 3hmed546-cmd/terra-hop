"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Mail, ArrowRight, ShieldCheck } from "lucide-react";

export default function AmbassadorLoginPage() {
  const router = useRouter();
  const [emailOrCode, setEmailOrCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ambassador/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailOrCode, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.message || data.error || "بيانات تسجيل الدخول غير صحيحة.");
        setLoading(false);
        return;
      }

      router.replace("/ambassador");
    } catch {
      setError("حدث خطأ في الاتصال بالسيرفر. يرجى المحاولة لاحقاً.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-[#F5F5F5] flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 font-sans selection:bg-white selection:text-black" dir="rtl">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-block tracking-widest text-3xl font-black uppercase text-white hover:opacity-80 transition-opacity">
          TERRA HOP
        </Link>
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs text-white/80 border border-white/15">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>بورتال سفراء الشارع (Street Ambassador)</span>
        </div>
        <h2 className="mt-4 text-xl font-bold tracking-tight text-white sm:text-2xl">
          تسجيل الدخول إلى حساب السفير
        </h2>
        <p className="mt-1 text-sm text-white/60">
          تابع مبيعاتك المؤكدة، مستوياتك، وأكواد خصم المكافآت 80%
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#171717] border border-[#262626] py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          {error && (
            <div className="mb-6 rounded-lg bg-red-950/50 border border-red-500/50 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-2">
                كود السفير أو البريد الإلكتروني
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={emailOrCode}
                  onChange={(e) => setEmailOrCode(e.target.value)}
                  placeholder="مثال: AHMED10 أو بريدك"
                  className="w-full bg-[#0D0D0D] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-white transition-colors text-left"
                  dir="ltr"
                />
                <div className="absolute inset-y-0 right-0 pl-3 flex items-center pointer-events-none pr-3">
                  <Mail className="h-4 w-4 text-white/40" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-2">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#0D0D0D] border border-[#333] rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-white transition-colors text-left"
                  dir="ltr"
                />
                <div className="absolute inset-y-0 right-0 pl-3 flex items-center pointer-events-none pr-3">
                  <Lock className="h-4 w-4 text-white/40" />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3.5 px-4 rounded-lg bg-white text-black font-bold text-sm tracking-wide hover:bg-neutral-200 transition-colors disabled:opacity-50"
            >
              {loading ? "جاري الدخول..." : "دخول البورتال"}
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[#262626] text-center text-xs text-white/40">
            للحصول على كود سفير أو استعادة كلمة المرور، يرجى التواصل مع إدارة المتجر على واتساب.
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-white/30 mt-6">
        &copy; 2026 TERRA HOP Streetwear &bull; سفراء الشارع
      </div>
    </div>
  );
}
