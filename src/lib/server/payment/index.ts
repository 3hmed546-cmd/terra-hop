import type { PaymentHandler } from "./types";
import { CashOnDeliveryHandler } from "./cod";

const registry = new Map<string, PaymentHandler>();

// Register default handler
const codHandler = new CashOnDeliveryHandler();
registry.set(codHandler.id, codHandler);

/**
 * Retrieve a payment handler by method ID (Open/Closed Principle)
 */
export function getPaymentHandler(id: string): PaymentHandler | undefined {
  return registry.get(id);
}

/**
 * Register a new payment handler (e.g. InstaPay, Vodafone Cash, Fawry)
 */
export function registerPaymentHandler(handler: PaymentHandler): void {
  registry.set(handler.id, handler);
}

/**
 * List all active and enabled payment methods
 */
export function getSupportedPaymentMethods(): string[] {
  return Array.from(registry.values())
    .filter((h) => h.isEnabled)
    .map((h) => h.id);
}

export * from "./types";
export * from "./concurrency";
