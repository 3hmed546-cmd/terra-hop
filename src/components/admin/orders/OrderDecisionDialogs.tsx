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
  const [deliveryDays, setDeliveryDays] = useState("من 2 إلى 4 أيام عمل");

  const close = () => {
    setReason("");
    setDeliveryDays("من 2 إلى 4 أيام عمل");
    onClose();
  };

  const effect = order ? stockEffectLines(order) : [];
  const returnsStock = order ? cancelReturnsStock(order) : false;

  const confirmSell = () => {
    if (!order) return;
    const result = (actions as any).sellOrder(order.id, deliveryDays);
    toast.push(result.ok ? `تم قبول الطلب ${order.number} وإرسال إيميل التوصيل للعميل بنجاح.` : (ADMIN_STRINGS.errors as any)[result.error] || "حدث خطأ");
    close();
    if (result.ok) onDone?.();
  };

  const confirmCancel = () => {
    if (!order) return;
    const result = actions.cancelOrder(order.id, reason.trim());
    toast.push(
      result.ok
        ? `تم إلغاء الطلب ${order.number} وإرسال إيميل التوضيح للعميل بنجاح.`
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

        <div style={{ marginTop: 18, borderTop: "1px solid var(--adm-line, #333)", paddingTop: 14 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 700 }}>
            مدة التوصيل المتوقعة (ستُرسل للعميل في الإيميل التلقائي):
          </label>
          <input
            type="text"
            className="adm-input"
            value={deliveryDays}
            onChange={(e) => setDeliveryDays(e.target.value)}
            placeholder="مثال: من 2 إلى 4 أيام عمل"
            style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--adm-line, #444)", background: "transparent", color: "inherit", fontSize: 13 }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {["من 2 إلى 3 أيام عمل", "من 3 إلى 5 أيام عمل", "خلال 48 ساعة"].map((d) => (
              <button
                key={d}
                type="button"
                className="adm-btn adm-btn-secondary"
                style={{ fontSize: 11, padding: "3px 8px", cursor: "pointer" }}
                onClick={() => setDeliveryDays(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
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
          hint="سيتم إرسال هذا السبب للعميل في رسالة بريد إلكتروني رسمية بلباقة."
          value={reason}
          maxLength={300}
          rows={3}
          onChange={(e) => setReason(e.target.value)}
        />
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {[
            "نفاد الكمية مؤقتاً",
            "العنوان خارج نطاق التوصيل",
            "تعذر التواصل هاتفياً لتأكيد الطلب",
            "بناءً على طلب العميل",
          ].map((r) => (
            <button
              key={r}
              type="button"
              className="adm-btn adm-btn-secondary"
              style={{ fontSize: 11, padding: "3px 8px", cursor: "pointer" }}
              onClick={() => setReason(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </Dialog>
    </>
  );
}
