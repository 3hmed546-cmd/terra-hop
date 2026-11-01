"use client";
import { useState } from "react";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";
import { colorName } from "@/lib/admin/inventory";
import { useAdminStore } from "@/lib/admin/store";
import type { Product } from "@/lib/admin/types";
import { Button, Dialog, NumberInput, TextInput, useToast } from "../ui";

const S = ADMIN_STRINGS.restock;

interface Props {
  /** The product to restock; the dialog is open while this is not null. */
  product: Product | null;
  onClose: () => void;
  /** Called after the stock was added. */
  onDone?: () => void;
}

function RestockBody({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone?: () => void }) {
  const { actions } = useAdminStore();
  const toast = useToast();
  const [adds, setAdds] = useState<Record<string, number | null>>({});
  const [note, setNote] = useState("");

  const lines = product.variants.map((v) => ({ variantId: v.id, add: adds[v.id] ?? 0 }));
  const total = lines.reduce((sum, l) => sum + l.add, 0);

  const submit = () => {
    if (total === 0) return;
    const result = actions.restockProduct(product.id, lines, note);
    toast.push(result.ok ? S.done(total, product.name) : ADMIN_STRINGS.errors[result.error]);
    onClose();
    if (result.ok) onDone?.();
  };

  return (
    <>
      <p>{S.text}</p>
      <ul className="adm-restock-list">
        {product.variants.map((v) => {
          const label = `${colorName(product, v.colorId)} · ${v.size}`;
          return (
            <li key={v.id}>
              <div>
                <div>{label}</div>
                <div className="adm-muted adm-small adm-num">{S.current(v.stock)}</div>
              </div>
              <NumberInput
                label={S.addLabel(label)}
                hideLabel
                min={0}
                max={9999}
                value={adds[v.id] ?? null}
                onChange={(n) => setAdds((a) => ({ ...a, [v.id]: n }))}
              />
            </li>
          );
        })}
      </ul>
      <TextInput label={S.reason} hint={S.reasonHint} value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} />
      <p role="status" className="adm-num"><strong>{S.totalAdd(total)}</strong></p>
      <div className="adm-dialog-foot">
        <Button variant="secondary" onClick={onClose}>{ADMIN_STRINGS.common.cancel}</Button>
        <Button aria-disabled={total === 0 ? true : undefined} onClick={submit}>{S.confirm}</Button>
      </div>
    </>
  );
}

export function RestockDialog({ product, onClose, onDone }: Props) {
  return (
    <Dialog open={product !== null} onClose={onClose} title={product ? S.title(product.name) : ""}>
      {/* Mounted only while open, so every opening starts with empty fields. */}
      {product ? <RestockBody key={product.id} product={product} onClose={onClose} onDone={onDone} /> : null}
    </Dialog>
  );
}
