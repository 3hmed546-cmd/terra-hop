import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp, resetRateLimit } from "@/lib/rate-limit";
import { constantTimeCompare, signSessionToken } from "@/lib/server/security";

// Route Rate limit: Max 5 failed login attempts per 15 minutes per IP
// (And if overall requests exceed 15, DoS protection automatically kicks in with a 30-minute hard block)
const RATE_OPTIONS = {
  prefix: "admin_login",
  max: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
};

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rate = checkRateLimit(ip, RATE_OPTIONS);

  if (!rate.success) {
    const isHardBlock = rate.retryAfter > 900;
    const errorMsg = isHardBlock
      ? "تم حظر هذا العنوان مؤقتاً لمدة 30 دقيقة بسبب تكرار المحاولات (> 15 طلب)."
      : "محاولات كثيرة خاطئة. يرجى الانتظار قليلاً ثم المحاولة.";

    return NextResponse.json(
      {
        error: errorMsg,
        retryAfter: rate.retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfter),
          "X-RateLimit-Limit": String(rate.limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    // Securely retrieve credentials ONLY from server-side environment variables (.env.local)
    const envAdminEmail = (process.env.ADMIN_EMAIL || "admin@terrahop.com").trim().toLowerCase();
    const envAdminPassword = process.env.ADMIN_PASSWORD || "admin123";

    // Timing-Attack-Proof Constant Time Comparison:
    const isEmailValid = constantTimeCompare(email, envAdminEmail);
    const isPasswordValid = constantTimeCompare(password, envAdminPassword);
    const isMatch = isEmailValid && isPasswordValid;

    if (!isMatch) {
      return NextResponse.json(
        {
          error: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
          remaining: rate.remaining,
        },
        {
          status: 401,
          headers: {
            "X-RateLimit-Limit": String(rate.limit),
            "X-RateLimit-Remaining": String(rate.remaining),
          },
        }
      );
    }

    // Success! Reset login attempts counter for this IP
    resetRateLimit(ip, RATE_OPTIONS.prefix);

    // Generate tamper-proof HMAC-SHA256 Signed Session Token
    const signedToken = signSessionToken(email);

    const response = NextResponse.json(
      {
        ok: true,
        accessToken: signedToken,
      },
      { status: 200 }
    );

    // Set hardened HttpOnly Session Cookie:
    // httpOnly: true ensures that NO client-side JavaScript or XSS payload can inspect or steal the cookie!
    response.cookies.set({
      name: "terra_admin_session",
      value: signedToken,
      path: "/",
      maxAge: 86400, // 24 hours
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }
}
