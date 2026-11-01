import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./seed";
import {
  formToSettings,
  isSettingsFormEqual,
  settingsToForm,
  validatePasswordForm,
  validateSettingsForm,
} from "./settings-form";

const good = () => settingsToForm(DEFAULT_SETTINGS);

describe("settings form", () => {
  it("round-trips the default settings without changing them", () => {
    expect(formToSettings(good(), DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });

  it("shows the shipping fee in pounds and saves it in piastres", () => {
    expect(good().shipping).toBe(60);
    expect(formToSettings({ ...good(), shipping: 75.5 }, DEFAULT_SETTINGS).shippingCents).toBe(7550);
    expect(formToSettings({ ...good(), shipping: 0.07 }, DEFAULT_SETTINGS).shippingCents).toBe(7);
  });

  it("trims the store name", () => {
    expect(formToSettings({ ...good(), storeName: "  Terra Hop Cairo " }, DEFAULT_SETTINGS).storeName).toBe("Terra Hop Cairo");
  });

  it("accepts the defaults and the edges of every range", () => {
    expect(validateSettingsForm(good())).toEqual({});
    expect(validateSettingsForm({ ...good(), shipping: 0, lowStock: 1, emailHours: 1 })).toEqual({});
    expect(validateSettingsForm({ ...good(), shipping: 10000, lowStock: 99, emailHours: 168 })).toEqual({});
  });

  it("rejects empty or out-of-range values with a code per field", () => {
    expect(validateSettingsForm({ ...good(), storeName: "   " }).storeName).toBe("STORE_NAME_REQUIRED");
    expect(validateSettingsForm({ ...good(), shipping: null }).shipping).toBe("SHIPPING_REQUIRED");
    expect(validateSettingsForm({ ...good(), shipping: 10000.01 }).shipping).toBe("SHIPPING_RANGE");
    expect(validateSettingsForm({ ...good(), lowStock: 0 }).lowStock).toBe("LOW_STOCK_RANGE");
    expect(validateSettingsForm({ ...good(), lowStock: 100 }).lowStock).toBe("LOW_STOCK_RANGE");
    expect(validateSettingsForm({ ...good(), lowStock: 2.5 }).lowStock).toBe("LOW_STOCK_RANGE");
    expect(validateSettingsForm({ ...good(), lowStock: null }).lowStock).toBe("LOW_STOCK_RANGE");
    expect(validateSettingsForm({ ...good(), emailHours: 0 }).emailHours).toBe("EMAIL_HOURS_RANGE");
    expect(validateSettingsForm({ ...good(), emailHours: 169 }).emailHours).toBe("EMAIL_HOURS_RANGE");
  });

  it("compares forms, ignoring spaces around the store name", () => {
    expect(isSettingsFormEqual(good(), { ...good(), storeName: " Terra Hop " })).toBe(true);
    expect(isSettingsFormEqual(good(), { ...good(), reservation: "hold" })).toBe(false);
    expect(isSettingsFormEqual(good(), { ...good(), shortcuts: false })).toBe(false);
    expect(isSettingsFormEqual(good(), { ...good(), sessionHours: 8 })).toBe(false);
  });
});

describe("password form (preview only)", () => {
  const ok = { current: "old-password", next: "a-long-new-password", confirm: "a-long-new-password" };

  it("accepts a valid change", () => {
    expect(validatePasswordForm(ok)).toEqual({});
  });

  it("asks for the current password", () => {
    expect(validatePasswordForm({ ...ok, current: "" }).current).toBe("CURRENT_REQUIRED");
  });

  it("needs 10 characters, exactly", () => {
    expect(validatePasswordForm({ current: "x", next: "123456789", confirm: "123456789" }).next).toBe("NEXT_TOO_SHORT");
    expect(validatePasswordForm({ current: "x", next: "1234567890", confirm: "1234567890" }).next).toBeUndefined();
  });

  it("refuses a new password equal to the current one", () => {
    expect(validatePasswordForm({ current: "same-password-1", next: "same-password-1", confirm: "same-password-1" }).next).toBe("NEXT_SAME");
  });

  it("flags a confirmation that does not match", () => {
    expect(validatePasswordForm({ ...ok, confirm: "different-one-123" }).confirm).toBe("CONFIRM_MISMATCH");
  });
});
