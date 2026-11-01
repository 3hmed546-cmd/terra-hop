"use client";
import { createContext, useContext } from "react";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";
import { Button, Dialog } from "./ui";

const T = ADMIN_STRINGS.shortcuts;

const HelpContext = createContext<{ open: () => void }>({ open: () => {} });
export const ShortcutHelpProvider = HelpContext.Provider;
export function useShortcutHelp() {
  return useContext(HelpContext);
}

export function ShortcutsDialog({ open, onClose, enabled }: { open: boolean; onClose: () => void; enabled: boolean }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={T.title}
      description={T.text}
      footer={<Button onClick={onClose}>{T.close}</Button>}
    >
      {!enabled ? <p className="adm-warn">{T.offNote}</p> : null}
      <ul className="adm-effect">
        {T.items.map((item) => (
          <li key={item.label}>
            <span>{item.label}</span>
            <span className="adm-num">
              {item.keys.map((k, i) => (
                <span key={k}>
                  {i > 0 ? <span className="adm-muted"> then </span> : null}
                  <kbd className="adm-kbd">{k}</kbd>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
