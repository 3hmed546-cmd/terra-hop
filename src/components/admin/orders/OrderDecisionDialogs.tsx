"use client";
import { useState } from "react";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";
import { cancelReturnsStock, stockEffectLines } from "@/lib/admin/orders";
import { useAdminStore } from "@/lib/admin/store";
import type { Order } from "@/lib/admin/types";
import { Button, Dialog, Textarea, useToast } from "../ui";

const S = ADMIN_STRINGS.orders.detail;

export type DecisionMode = "confirm" | "deliver" | "sell" | "cancel";

interface Props {
  /** The order being decided; the dialogs are closed while `mode` is null. */
  order: Order | null;
  mode: DecisionMode | null;
  onClose: () => void;
  /** Called after the decision was made (not when it was dismissed). */
  onDone?: () => void;
}

/** Two-step order lifecycle dialogs: Confirm Order & Ship, or Complete Delivery & Paid */
export function OrderDecisionDialogs({ order, mode, onClose, onDone }: Props) {
  const { actions } = useAdminStore();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("خلال 48 ساعة");

  const close = () => {
    setReason("");
    setDeliveryDays("خلال 48 ساعة");
    onClose();
  };

  const effect = order ? stockEffectLines(order) : [];
  const returnsStock = order ? cancelReturnsStock(order) : false;

  // Step 1: Confirm Order & Start Processing/Shipping
  const confirmProcessing = () => {
    if (!order) return;
    const result = (actions as any).confirmOrderProcessing(order.id, deliveryDays);
    toast.push(
      result.ok
        ? `تم تأكيد الأوردر ${order.number} وبدء الشحن وإرسال إيميل المواعيد للعميل بنجاح.`
        : (ADMIN_STRINGS.errors as any)[result.error] || "حدث خطأ"
    );
    close();
    if (result.ok) onDone?.();
  };

  // Step 2: Complete Order Delivery & COD Collection
  const confirmDelivery = () => {
    if (!order) return;
    const result = (actions as any).completeOrderDelivery(order.id);
    toast.push(
      result.ok
        ? `تم اكتمال تسليم الأوردر ${order.number} وتحصيله، وإرسال إيميل الشكر ودعوة واتساب VIP للعميل بنجاح!`
        : (ADMIN_STRINGS.errors as any)[result.error] || "حدث خطأ"
    );
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

  const isConfirmMode = mode === "confirm" || (mode === "sell" && order?.status !== "PROCESSING");
  const isDeliverMode = mode === "deliver" || (mode === "sell" && order?.status === "PROCESSING");

  return (
    <>
      {/* Dialog 1: Confirm Order & Start Processing / Shipping */}
      <Dialog
        open={isConfirmMode && order !== null}
        onClose={close}
        title={order ? `تأكيد أوردر ${order.number} وبدء الشحن` : ""}
        description="سيتم تغيير حالة الطلب إلى (مؤكد وقيد الشحن) وإرسال إيميل تلقائي للعميل بموعد التوصيل المحدد."
        footer={
          <>
            <Button variant="secondary" onClick={close}>{ADMIN_STRINGS.common.cancel}</Button>
            <Button onClick={confirmProcessing}>تأكيد الأوردر وبدء الشحن</Button>
          </>
        }
      >
        <p className="adm-label adm-muted">القطع في هذا الطلب:</p>
        <ul className="adm-effect">
          {effect.map((line) => (
            <li key={line.label}>
              {line.label} <strong className="adm-num">× {line.qty}</strong>
            </li>
          ))}
        </ul>

        <div style={{ marginTop: 18, borderTop: "1px solid var(--adm-line, #333)", paddingTop: 14 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 700 }}>
            موعد التوصيل المتوقع (يُرسل في إيميل الشحن للعميل):
          </label>
          <input
            type="text"
            className="adm-input"
            value={deliveryDays}
            onChange={(e) => setDeliveryDays(e.target.value)}
            placeholder="مثال: خلال 48 ساعة"
            style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid var(--adm-line, #444)", background: "transparent", color: "inherit", fontSize: 13 }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {["خلال 48 ساعة", "من 2 إلى 3 أيام عمل", "من 3 إلى 5 أيام عمل"].map((d) => (
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

      {/* Dialog 2: Complete Delivery & Paid */}
      <Dialog
        open={isDeliverMode && order !== null}
        onClose={close}
        title={order ? `اكتمال تسليم الأوردر ${order.number}` : ""}
        description="تأكيد أن مندوب الشحن سلّم الشحنة للعميل وحصّل المبلغ نقداً. سيتم تسجيل المبيعة نهائياً، واحتساب عمولة السفير، وإرسال رسالة شكر للعميل برابط جروب واتساب VIP."
        footer={
          <>
            <Button variant="secondary" onClick={close}>{ADMIN_STRINGS.common.cancel}</Button>
            <Button onClick={confirmDelivery} style={{ backgroundColor: "#10b981", color: "#ffffff" }}>
              تأكيد اكتمال التسليم والتحصيل
            </Button>
          </>
        }
      >
        <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 6, padding: 12, marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 13, color: "#10b981", fontWeight: 600 }}>
            عند التأكيد، سيصل إيميل شكر رسمي للعميل يحتوي على زر الانضمام لجروب واتساب VIP للحصول على أكواد خصم حصرية للأعضاء.
          </p>
        </div>
        <p className="adm-label adm-muted">إجمالي المبلغ المحصّل:</p>
        <p className="adm-num" style={{ fontSize: 18, fontWeight: 800, margin: "4px 0 0" }}>
          {order?.totalCents ? `${(order.totalCents / 100).toLocaleString("ar-EG")} ج.م` : ""}
        </p>
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
