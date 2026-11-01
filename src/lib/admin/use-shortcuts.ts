"use client";
import { useEffect, useRef } from "react";
import {
  handleShortcutKey,
  INITIAL_SHORTCUT_STATE,
  isTypingElement,
  type ShortcutAction,
  type ShortcutState,
} from "./shortcuts";

/** Listens for keys on the whole page and hands recognised shortcuts to `onAction`. */
export function useShortcuts(enabled: boolean, onAction: (action: ShortcutAction) => void): void {
  const stateRef = useRef<ShortcutState>(INITIAL_SHORTCUT_STATE);
  const actionRef = useRef(onAction);
  useEffect(() => {
    actionRef.current = onAction;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const result = handleShortcutKey(
        stateRef.current,
        {
          key: e.key,
          code: e.code,
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          altKey: e.altKey,
          repeat: e.repeat,
          isComposing: e.isComposing,
          defaultPrevented: e.defaultPrevented,
          typing: isTypingElement(document.activeElement),
          modalOpen: document.querySelector("dialog[open]") !== null,
        },
        Date.now(),
        enabled,
      );
      stateRef.current = result.state;
      if (result.action) {
        e.preventDefault();
        actionRef.current(result.action);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled]);
}
