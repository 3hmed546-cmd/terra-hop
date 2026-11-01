import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { apiSuccess } from "@/lib/server/api-envelope";
import { generateCsrfToken } from "@/lib/server/security";

export async function GET(request: NextRequest) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user || !auth.sessionId) {
    return auth.responseError!;
  }

  const csrfToken = generateCsrfToken(auth.sessionId);
  const response = apiSuccess({
    user: auth.user,
    csrfToken,
  });

  response.headers.set("X-CSRF-Token", csrfToken);
  return response;
}
