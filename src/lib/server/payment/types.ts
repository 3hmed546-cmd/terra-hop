export interface PaymentContext {
  orderId: string;
  orderNumber: string;
  totalCents: number;
  customer: {
    name: string;
    phone: string;
    email?: string;
  };
}

export interface PaymentProcessResult {
  ok: boolean;
  status: "AWAITING_APPROVAL" | "PAID" | "PENDING_PAYMENT";
  instructions?: string;
  redirectUrl?: string;
}

export interface PaymentHandler {
  readonly id: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly isEnabled: boolean;
  process(ctx: PaymentContext): Promise<PaymentProcessResult>;
}
