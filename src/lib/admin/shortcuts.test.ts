import { describe, expect, it } from "vitest";
import {
  handleShortcutKey,
  INITIAL_SHORTCUT_STATE,
  isTypingElement,
  normalizeKey,
  SEQUENCE_MS,
  type KeyInfo,
  type ShortcutState,
} from "./shortcuts";

const key = (k: string, extra: Partial<KeyInfo> = {}): KeyInfo => ({
  key: k, code: "", shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, repeat: false,
  isComposing: false, defaultPrevented: false, typing: false, modalOpen: false, ...extra,
});

function press(state: ShortcutState, info: KeyInfo, now: number, enabled = true) {
  return handleShortcutKey(state, info, now, enabled);
}

describe("keyboard shortcuts", () => {
  it("goes to a page with G then a letter", () => {
    const first = press(INITIAL_SHORTCUT_STATE, key("g"), 1000);
    expect(first.action).toBeNull();
    expect(press(first.state, key("o"), 1200).action).toEqual({ type: "go", path: "/orders" });
    expect(press(first.state, key("d"), 1200).action).toEqual({ type: "go", path: "/dashboard" });
    expect(press(first.state, key("p"), 1200).action).toEqual({ type: "go", path: "/products" });
    expect(press(first.state, key("s"), 1200).action).toEqual({ type: "go", path: "/settings" });
  });

  it("accepts capital letters (Caps Lock)", () => {
    const first = press(INITIAL_SHORTCUT_STATE, key("G"), 0);
    expect(press(first.state, key("O"), 10).action).toEqual({ type: "go", path: "/orders" });
  });

  it("forgets the G after the time limit and after any other key", () => {
    const first = press(INITIAL_SHORTCUT_STATE, key("g"), 0);
    expect(press(first.state, key("o"), SEQUENCE_MS + 1).action).toBeNull();
    const cancelled = press(first.state, key("x"), 100);
    expect(cancelled.state.pendingG).toBeNull();
    expect(press(cancelled.state, key("o"), 200).action).toBeNull();
  });

  it("a second G starts the sequence again", () => {
    const first = press(INITIAL_SHORTCUT_STATE, key("g"), 0);
    const second = press(first.state, key("g"), 500);
    expect(press(second.state, key("o"), 600).action).toEqual({ type: "go", path: "/orders" });
  });

  it("has single-key shortcuts for new product, record a sale, search and help", () => {
    expect(press(INITIAL_SHORTCUT_STATE, key("n"), 0).action).toEqual({ type: "go", path: "/products/new" });
    expect(press(INITIAL_SHORTCUT_STATE, key("r"), 0).action).toEqual({ type: "go", path: "/sales/new" });
    expect(press(INITIAL_SHORTCUT_STATE, key("/"), 0).action).toEqual({ type: "focus-search" });
    expect(press(INITIAL_SHORTCUT_STATE, key("?", { shiftKey: true }), 0).action).toEqual({ type: "help" });
  });

  it("ignores unknown keys", () => {
    expect(press(INITIAL_SHORTCUT_STATE, key("z"), 0).action).toBeNull();
    expect(press(INITIAL_SHORTCUT_STATE, key("Enter"), 0).action).toBeNull();
  });

  it("does nothing while typing, with a modal open, with a modifier, on key repeat or while composing", () => {
    for (const extra of [
      { typing: true }, { modalOpen: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true },
      { repeat: true }, { isComposing: true }, { defaultPrevented: true },
    ] as Partial<KeyInfo>[]) {
      expect(press(INITIAL_SHORTCUT_STATE, key("n", extra), 0).action).toBeNull();
      expect(press(INITIAL_SHORTCUT_STATE, key("g", extra), 0).state.pendingG).toBeNull();
    }
  });

  it("does nothing at all when shortcuts are turned off", () => {
    expect(press(INITIAL_SHORTCUT_STATE, key("n"), 0, false).action).toBeNull();
    expect(press(INITIAL_SHORTCUT_STATE, key("g"), 0, false).state.pendingG).toBeNull();
  });

  it("works on an Arabic keyboard layout by using the physical key", () => {
    // On the Arabic layout the G key types "ل" and the slash key types "ظ".
    expect(normalizeKey({ key: "ل", code: "KeyG", shiftKey: false })).toBe("g");
    expect(normalizeKey({ key: "ظ", code: "Slash", shiftKey: false })).toBe("/");
    expect(normalizeKey({ key: "؟", code: "Slash", shiftKey: true })).toBe("?");
    const first = press(INITIAL_SHORTCUT_STATE, key("ل", { code: "KeyG" }), 0);
    expect(press(first.state, key("ى", { code: "KeyO" }), 10).action).toEqual({ type: "go", path: "/orders" });
  });
});

describe("isTypingElement", () => {
  const el = (tagName: string, extra: Record<string, unknown> = {}) => ({ tagName, ...extra }) as unknown as Element;

  it("treats text fields, selects and textareas as typing", () => {
    expect(isTypingElement(el("INPUT", { type: "text" }))).toBe(true);
    expect(isTypingElement(el("INPUT", { type: "search" }))).toBe(true);
    expect(isTypingElement(el("INPUT", { type: "password" }))).toBe(true);
    expect(isTypingElement(el("TEXTAREA"))).toBe(true);
    expect(isTypingElement(el("SELECT"))).toBe(true);
    expect(isTypingElement(el("DIV", { isContentEditable: true }))).toBe(true);
  });

  it("does not treat buttons, checkboxes, radios or links as typing", () => {
    expect(isTypingElement(el("INPUT", { type: "checkbox" }))).toBe(false);
    expect(isTypingElement(el("INPUT", { type: "radio" }))).toBe(false);
    expect(isTypingElement(el("BUTTON"))).toBe(false);
    expect(isTypingElement(el("A"))).toBe(false);
    expect(isTypingElement(null)).toBe(false);
  });
});
