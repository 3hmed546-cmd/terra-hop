// Access token held in module memory and synced with localStorage and session cookie for reliable auth.
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null; // Single-flight refresh

const TOKEN_KEY = "terra_admin_token";

export function getAccessToken(): string | null {
  if (!accessToken && typeof window !== "undefined") {
    accessToken = window.localStorage.getItem(TOKEN_KEY);
  }
  return accessToken;
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  const token = getAccessToken();
  return Boolean(token && token.length > 20);
}

function persistSession(token: string) {
  accessToken = token;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Storage restricted or disabled
    }
  }
}

/**
 * Clean & Secure login function:
 * Passes credentials ONLY to the secure server endpoint (/api/auth/login).
 * NO credentials or passwords are kept in the client bundle.
 */
export async function login(email: string, password: string) {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "terra-admin",
      },
      body: JSON.stringify({ email, password }),
      credentials: "same-origin",
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      persistSession(data.accessToken || "terra-admin-session-active");
      return { ok: true as const };
    }

    const data = await res.json().catch(() => ({}));
    const retryAfter = Number(res.headers.get("Retry-After")) || undefined;
    return {
      ok: false as const,
      status: res.status,
      error: data.error || "فشل تسجيل الدخول",
      retryAfter,
    };
  } catch {
    return { ok: false as const, status: 500, error: "تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت." };
  }
}

// Called on admin panel mount (page refresh clears in-memory token) and on 401
export function silentRefresh(): Promise<boolean> {
  refreshing ??= fetch("/api/refresh", {
    method: "POST",
    headers: { "X-Requested-With": "terra-admin" },
    credentials: "same-origin",
    cache: "no-store",
  })
    .then(async (r) => {
      if (!r.ok) {
        accessToken = null;
        return false;
      }
      const data = await r.json();
      accessToken = data.accessToken;
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });

  return refreshing;
}

export async function apiFetch(input: string, init: RequestInit = {}) {
  const run = () =>
    fetch(input, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: "same-origin",
    });

  let res = await run();
  if (res.status === 401 && (await silentRefresh())) {
    res = await run();
  }
  return res;
}

export async function logout() {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "X-Requested-With": "terra-admin" },
      credentials: "same-origin",
    });
  } catch {
    // Ignore network error on logout
  }
  accessToken = null;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
      document.cookie = "terra_admin_session=; path=/; max-age=0";
    } catch {
      // Storage restricted
    }
    window.location.replace("/admin");
  }
}
