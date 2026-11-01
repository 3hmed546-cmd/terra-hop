/** Settings form: state, validation and conversion. Pure functions, no React. */
import type { Settings } from "./types";

export const SESSION_HOUR_CHOICES = [1, 8, 24, 72, 168] as const;

export interface SettingsFormState {
  storeName: string;
  /** Whole pounds with up to two decimals, as typed. null = empty. */
  shipping: number | null;
  lowStock: number | null;
  reservation: Settings["reservation"];
  emailHours: number | null;
  sessionHours: number;
  shortcuts: boolean;
}

export type SettingsErrorCode =
  | "STORE_NAME_REQUIRED"
  | "SHIPPING_REQUIRED"
  | "SHIPPING_RANGE"
  | "LOW_STOCK_RANGE"
  | "EMAIL_HOURS_RANGE";

export type SettingsErrors = Partial<Record<"storeName" | "shipping" | "lowStock" | "emailHours", SettingsErrorCode>>;

export function settingsToForm(s: Settings): SettingsFormState {
  return {
    storeName: s.storeName,
    shipping: s.shippingCents / 100,
    lowStock: s.lowStockThreshold,
    reservation: s.reservation,
    emailHours: s.emailTokenHours,
    sessionHours: s.sessionHours,
    shortcuts: s.shortcuts,
  };
}

export function validateSettingsForm(f: SettingsFormState): SettingsErrors {
  const errors: SettingsErrors = {};
  if (f.storeName.trim() === "") errors.storeName = "STORE_NAME_REQUIRED";
  if (f.shipping === null) errors.shipping = "SHIPPING_REQUIRED";
  else if (!Number.isFinite(f.shipping) || f.shipping < 0 || f.shipping > 10000) errors.shipping = "SHIPPING_RANGE";
  if (f.lowStock === null || !Number.isInteger(f.lowStock) || f.lowStock < 1 || f.lowStock > 99) errors.lowStock = "LOW_STOCK_RANGE";
  if (f.emailHours === null || !Number.isInteger(f.emailHours) || f.emailHours < 1 || f.emailHours > 168) {
    errors.emailHours = "EMAIL_HOURS_RANGE";
  }
  return errors;
}

/** Call only after validateSettingsForm returned no errors. */
export function formToSettings(f: SettingsFormState, base: Settings): Settings {
  return {
    ...base,
    storeName: f.storeName.trim(),
    shippingCents: Math.round((f.shipping ?? 0) * 100),
    lowStockThreshold: f.lowStock ?? base.lowStockThreshold,
    reservation: f.reservation,
    emailTokenHours: f.emailHours ?? base.emailTokenHours,
    sessionHours: f.sessionHours,
    shortcuts: f.shortcuts,
  };
}

export function isSettingsFormEqual(a: SettingsFormState, b: SettingsFormState): boolean {
  return (
    a.storeName.trim() === b.storeName.trim() &&
    a.shipping === b.shipping &&
    a.lowStock === b.lowStock &&
    a.reservation === b.reservation &&
    a.emailHours === b.emailHours &&
    a.sessionHours === b.sessionHours &&
    a.shortcuts === b.shortcuts
  );
}

/* ---------- password form (preview only: nothing is stored) ---------- */

export interface PasswordFormState {
  current: string;
  next: string;
  confirm: string;
}
export type PasswordErrorCode = "CURRENT_REQUIRED" | "NEXT_TOO_SHORT" | "NEXT_SAME" | "CONFIRM_MISMATCH";
export type PasswordErrors = Partial<Record<keyof PasswordFormState, PasswordErrorCode>>;

export const MIN_PASSWORD_LENGTH = 10;

export function validatePasswordForm(f: PasswordFormState): PasswordErrors {
  const errors: PasswordErrors = {};
  if (f.current === "") errors.current = "CURRENT_REQUIRED";
  if (f.next.length < MIN_PASSWORD_LENGTH) errors.next = "NEXT_TOO_SHORT";
  else if (f.next === f.current) errors.next = "NEXT_SAME";
  if (!errors.next && f.confirm !== f.next) errors.confirm = "CONFIRM_MISMATCH";
  if (errors.next && f.confirm !== "" && f.confirm !== f.next) errors.confirm = "CONFIRM_MISMATCH";
  return errors;
}
