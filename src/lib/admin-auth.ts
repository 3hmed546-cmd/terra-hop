// Enterprise-grade admin authentication (Cookie-first, zero localStorage tokens)
let adminUser: { id: string; email: string } | null = null;
let csrfToken: string | null = null;
let isSessionActive = false;
let checkAuthPromise: Promise<boolean> | null = null;

export function getAccessToken(): string | null {
  return csrfToken;
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  // Check memory state, readable cookie, or session cookie indicator
  return (
    isSessionActive ||
    document.cookie.includes("terra_admin_logged_in=1") ||
    document.cookie.includes("terra_admin_session=")
  );
}

export function getAdminUser() {
  return adminUser;
}

export async function checkAuth(): Promise<boolean> {
  if (checkAuthPromise) return checkAuthPromise;

  checkAuthPromise = (async () => {
    try {
      const res = await fetch("/api/admin/auth/me", {
        method: "GET",
        headers: { "X-Requested-With": "terra-admin" },
        credentials: "same-origin",
        cache: "no-store",
      });

      if (res.ok) {
        const payload = await res.json();
        if (payload.ok && payload.data) {
          adminUser = payload.data.user;
          csrfToken = payload.data.csrfToken || res.headers.get("x-csrf-token");
          isSessionActive = true;
          return true;
        }
      }
      isSessionActive = false;
      adminUser = null;
      csrfToken = null;
      return false;
    } catch {
      isSessionActive = false;
      return false;
    } finally {
      checkAuthPromise = null;
    }
  })();

  return checkAuthPromise;
}

export const silentRefresh = checkAuth;

/**
 * Login function:
 * Credentials sent exclusively via HTTPS to /api/admin/auth/login.
 * Session established strictly via HttpOnly cookie (no localStorage token).
 */
export async function login(email: string, password: string) {
  try {
    const res = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "terra-admin",
      },
      body: JSON.stringify({ email, password }),
      credentials: "same-origin",
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.ok) {
      adminUser = data.data.user;
      csrfToken = data.data.csrfToken || res.headers.get("x-csrf-token");
      isSessionActive = true;
      return { ok: true as const, mustChangePassword: data.data.mustChangePassword };
    }

    const retryAfter = Number(res.headers.get("Retry-After")) || undefined;
    return {
      ok: false as const,
      status: res.status,
      error: data.error?.message || data.error || "فشل تسجيل الدخول",
      retryAfter,
    };
  } catch {
    return {
      ok: false as const,
      status: 500,
      error: "تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.",
    };
  }
}

/**
 * Uniform API fetcher with CSRF token and Same-Origin credentials
 */
export async function apiFetch(input: string, init: RequestInit = {}) {
  // If we don't have a CSRF token yet for a mutation, fetch /me first
  const method = (init.method || "GET").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && !csrfToken) {
    await checkAuth();
  }

  const run = () =>
    fetch(input, {
      ...init,
      headers: {
        ...init.headers,
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        "X-Requested-With": "terra-admin",
      },
      credentials: "same-origin",
    });

  let res = await run();
  if ((res.status === 401 || res.status === 403) && (await checkAuth())) {
    res = await run();
  }
  return res;
}

export async function logout() {
  try {
    await fetch("/api/admin/auth/logout", {
      method: "POST",
      headers: {
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        "X-Requested-With": "terra-admin",
      },
      credentials: "same-origin",
    });
  } catch {
    // Ignore network error on logout
  }

  isSessionActive = false;
  adminUser = null;
  csrfToken = null;

  if (typeof window !== "undefined") {
    window.location.replace("/admin");
  }
}
