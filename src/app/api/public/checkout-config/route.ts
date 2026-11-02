import { getDb } from "@/lib/server/db";
import { seedDatabaseIfNeeded } from "@/lib/server/seed-db";
import { apiSuccess } from "@/lib/server/api-envelope";
import { getShippingRules } from "@/lib/server/shipping";
import { getSupportedPaymentMethods } from "@/lib/server/payment";

export async function GET() {
  seedDatabaseIfNeeded();
  const r = getShippingRules(getDb());
  return apiSuccess({
    currency: "EGP",
    shippingCents: r.flatRateCents,
    freeShippingMinQuantity: r.freeShippingMinQuantity,
    freeShippingMinAmountCents: r.freeShippingMinAmountCents,
    paymentMethods: getSupportedPaymentMethods(),
  });
}
