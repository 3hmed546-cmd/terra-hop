"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  variant?: "modal" | "fullscreen";
}

/**
 * Built on the native <dialog>: the browser traps focus, makes the page behind inert,
 * closes on Escape and returns focus to the button that opened it.
 */
export function Dialog({ open, onClose, title, description, children, footer, variant = "modal" }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`adm-dialog${variant === "fullscreen" ? " adm-menu" : ""}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // click on the backdrop
      }}
    >
      <div className="adm-dialog-body">
        <h2 id={titleId} className="adm-h2">{title}</h2>
        {description ? <p id={descId}>{description}</p> : null}
        {children}
        {footer ? <div className="adm-dialog-foot">{footer}</div> : null}
      </div>
    </dialog>
  );
}
