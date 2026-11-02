import type { PaymentHandler, PaymentContext, PaymentProcessResult } from "./types";

export class CashOnDeliveryHandler implements PaymentHandler {
  readonly id = "cod";
  readonly nameAr = "الدفع عند الاستلام";
  readonly nameEn = "Cash on Delivery";
  readonly isEnabled = true;

  async process(_ctx: PaymentContext): Promise<PaymentProcessResult> {
    return {
      ok: true,
      status: "AWAITING_APPROVAL",
      instructions: "يتم دفع قيمة الطلب نقداً عند استلام الشحنة ومعاينتها.",
    };
  }
}
