"use client";
import { useState } from "react";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";
import { cancelReturnsStock, stockEffectLines } from "@/lib/admin/orders";
import { useAdminStore } from "@/lib/admin/store";
import type { Order } from "@/lib/admin/types";
import { Button, Dialog, Textarea, useToast } from "../ui";

const S = ADMIN_STRINGS.orders.detail;

export type DecisionMode = "sell" | "cancel";

interface Props {
  /** The order being decided; the dialogs are closed while `mode` is null. */
  order: Order | null;
  mode: DecisionMode | null;
  onClose: () => void;
  /** Called after the decision was made (not when it was dismissed). */
  onDone?: () => void;
}

/** Mark as sold / Cancel confirmation dialogs, shared by the order page and the Dashboard. */
export function OrderDecisionDialogs({ order, mode, onClose, onDone }: Props) {
  const { actions } = useAdminStore();
  const toast = useToast();
  const [reason, setReason] = useState("");

  const close = () => {
    setReason("");
    onClose();
  };

  const effect = order ? stockEffectLines(order) : [];
  const returnsStock = order ? cancelReturnsStock(order) : false;

  const confirmSell = () => {
    if (!order) return;
    const result = actions.sellOrder(order.id);
    toast.push(result.ok ? S.sellDialog.done(order.number) : ADMIN_STRINGS.errors[result.error]);
    close();
    if (result.ok) onDone?.();
  };

  const confirmCancel = () => {
    if (!order) return;
    const result = actions.cancelOrder(order.id, reason.trim());
    toast.push(
      result.ok
        ? returnsStock
          ? S.cancelDialog.doneRestocked(order.number)
          : S.cancelDialog.done(order.number)
        : ADMIN_STRINGS.errors[result.error],
    );
    close();
    if (result.ok) onDone?.();
  };

  return (
    <>
      <Dialog
        open={mode === "sell" && order !== null}
        onClose={close}
        title={order ? S.sellDialog.title(order.number) : ""}
        description={S.sellDialog.text}
        footer={
          <>
            <Button variant="secondary" onClick={close}>{ADMIN_STRINGS.common.cancel}</Button>
            <Button onClick={confirmSell}>{S.sellDialog.confirm}</Button>
          </>
        }
      >
        <p className="adm-label adm-muted">{S.sellDialog.deduct}</p>
        <ul className="adm-effect">
          {effect.map((line) => (
            <li key={line.label}>
              {line.label} <strong className="adm-num">− {line.qty}</strong>
            </li>
          ))}
        </ul>
      </Dialog>

      <Dialog
        open={mode === "cancel" && order !== null}
        onClose={close}
        title={order ? S.cancelDialog.title(order.number) : ""}
        description={returnsStock ? S.cancelDialog.textSold : S.cancelDialog.textOpen}
        footer={
          <>
            <Button variant="secondary" onClick={close}>{S.cancelDialog.keep}</Button>
            <Button onClick={confirmCancel}>{S.cancelDialog.confirm}</Button>
          </>
        }
      >
        {returnsStock ? (
          <>
            <p className="adm-warn" role="alert">{S.cancelDialog.return}</p>
            <ul className="adm-effect">
              {effect.map((line) => (
                <li key={line.label}>
                  {line.label} <strong className="adm-num">+ {line.qty}</strong>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <Textarea
          label={S.cancelDialog.reason}
          hint={S.cancelDialog.reasonHint}
          value={reason}
          maxLength={300}
          rows={3}
          onChange={(e) => setReason(e.target.value)}
        />
      </Dialog>
    </>
  );
}
