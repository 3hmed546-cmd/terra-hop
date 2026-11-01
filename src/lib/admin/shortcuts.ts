/**
 * Keyboard shortcuts as pure logic. The React hook only forwards key events here.
 * Two-key sequences ("G" then "O") must finish within SEQUENCE_MS.
 */
export const SEQUENCE_MS = 1500;

export type ShortcutAction =
  | { type: "go"; path: string }
  | { type: "focus-search" }
  | { type: "help" };

export interface KeyInfo {
  key: string;
  /** Physical key (KeyboardEvent.code). Lets the shortcuts work on an Arabic keyboard layout too. */
  code: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat: boolean;
  isComposing: boolean;
  defaultPrevented: boolean;
  /** true when focus is in a text field, select, textarea or editable element */
  typing: boolean;
  /** true when a modal dialog is open */
  modalOpen: boolean;
}

export interface ShortcutState {
  /** timestamp of the last "G", or null */
  pendingG: number | null;
}

export const INITIAL_SHORTCUT_STATE: ShortcutState = { pendingG: null };

const GO: Record<string, string> = {
  d: "/dashboard",
  p: "/products",
  o: "/orders",
  s: "/settings",
};

export function isTypingElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type;
    // buttons, checkboxes and radios do not take typed text, so shortcuts stay available there
    return !["button", "checkbox", "radio", "submit", "reset", "range", "color", "file", "image"].includes(type);
  }
  return (el as HTMLElement).isContentEditable === true;
}

/** Letter keys are matched by physical position, so G works whatever the keyboard language is. */
export function normalizeKey(info: Pick<KeyInfo, "key" | "code" | "shiftKey">): string {
  const letter = /^Key([A-Z])$/.exec(info.code);
  if (letter) return letter[1]!.toLowerCase();
  if (info.code === "Slash") return info.shiftKey ? "?" : "/";
  return info.key.length === 1 ? info.key.toLowerCase() : info.key;
}

export function handleShortcutKey(
  state: ShortcutState,
  info: KeyInfo,
  now: number,
  enabled: boolean,
): { state: ShortcutState; action: ShortcutAction | null } {
  const idle = { state: INITIAL_SHORTCUT_STATE, action: null };
  if (!enabled) return idle;
  if (info.ctrlKey || info.metaKey || info.altKey || info.repeat || info.isComposing || info.defaultPrevented) return idle;
  if (info.typing || info.modalOpen) return idle;

  const key = normalizeKey(info);

  if (state.pendingG !== null && now - state.pendingG <= SEQUENCE_MS) {
    const path = GO[key];
    if (path) return { state: INITIAL_SHORTCUT_STATE, action: { type: "go", path } };
    // any other key cancels the sequence; a second "g" starts a new one
    if (key === "g") return { state: { pendingG: now }, action: null };
    return idle;
  }

  switch (key) {
    case "g":
      return { state: { pendingG: now }, action: null };
    case "n":
      return { state: INITIAL_SHORTCUT_STATE, action: { type: "go", path: "/products/new" } };
    case "r":
      return { state: INITIAL_SHORTCUT_STATE, action: { type: "go", path: "/sales/new" } };
    case "/":
      return { state: INITIAL_SHORTCUT_STATE, action: { type: "focus-search" } };
    case "?":
      return { state: INITIAL_SHORTCUT_STATE, action: { type: "help" } };
    default:
      return idle;
  }
}
