"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Phone, MessageCircle, MapPin, CheckCircle, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/admin/ui/Button";
import { Dialog } from "@/components/admin/ui/Dialog";
import { StatCard } from "@/components/admin/ui/StatCard";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import { TextInput } from "@/components/admin/ui/TextInput";
import { useToast } from "@/components/admin/ui/Toast";
import { formatMoney } from "@/lib/admin/format";
import { deriveProductStatus, productTotalStock } from "@/lib/admin/inventory";
import { adminHref } from "@/lib/admin/paths";
import { useAdminStore } from "@/lib/admin/store";
import { AdminPushToggle } from "@/components/admin/ui/AdminPushToggle";
import type { Order } from "@/lib/admin/types";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";

function getItemImage(productName: string, colorName: string, pid?: string): string {
  const p = (pid || "").toLowerCase();
  const n = (productName || "").toLowerCase();
  const c = (colorName || "").toLowerCase();

  if (p.includes("dusty-blue") || c.includes("dusty") || c.includes("blue") || n.includes("dusty")) return "/login-hoodies/hoodie-dusty-blue.webp";
  if ((p.includes("off-white") || c.includes("off-white") || n.includes("off-white")) && (p.includes("hoodie") || n.includes("hoodie"))) return "/login-hoodies/hoodie-offwhite.webp";
  if (p.includes("chocolate") || p.includes("vintage-brown") || c.includes("chocolate") || c.includes("brown") || n.includes("chocolate") || n.includes("brown")) return "/login-hoodies/hoodie-chocolate.webp";
  if (p.includes("forest") || c.includes("forest") || c.includes("olive") || n.includes("forest")) return "/login-hoodies/hoodie-forest.webp";
  if (p.includes("deep-teal") || c.includes("teal") || n.includes("teal")) return "/login-hoodies/hoodie-deep-teal.webp";
  if (p.includes("washed-black") || c.includes("washed") || n.includes("washed black")) return "/login-hoodies/hoodie-washed-black.webp";
  if (p.includes("charcoal") || c.includes("charcoal") || n.includes("charcoal")) return "/login-hoodies/hoodie-charcoal.webp";
  if (p.includes("slate-navy") || c.includes("navy") || n.includes("navy")) return "/login-hoodies/hoodie-slate-navy.webp";
  if (p.includes("sand-beige") || c.includes("beige") || n.includes("beige")) return "/login-hoodies/hoodie-sand-beige.webp";
  if (p.includes("hoodie") || n.includes("hoodie")) return "/login-hoodies/hoodie-black.webp";

  if (p.includes("off-white") || n.includes("off-white")) return "/preview-images/tee-offwhite-1.jpg";
  if (p.includes("grey") || n.includes("grey")) return "/preview-images/tee-grey-1.jpg";
  return "/preview-images/tee-black-1.jpg";
}

export function DashboardOverview() {
  const { data, ready, actions } = useAdminStore();
  const toast = useToast();

  const [confirmTarget, setConfirmTarget] = useState<Order | null>(null);
  const [deliverTarget, setDeliverTarget] = useState<Order | null>(null);
  const [deliveryDays, setDeliveryDays] = useState("خلال 48 ساعة");
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const threshold = data?.settings.lowStockThreshold ?? 3;

  // KPI Calculations
  const orders = useMemo(() => data?.orders ?? [], [data]);
  const products = useMemo(() => data?.products ?? [], [data]);

  const needsActionOrders = useMemo(() => {
    return orders.filter((o) => o.status === "AWAITING_APPROVAL" || o.status === "PROCESSING");
  }, [orders]);

  const soldOrders = useMemo(() => {
    return orders.filter((o) => o.status === "SOLD");
  }, [orders]);

  const totalRevenueCents = useMemo(() => {
    return soldOrders.reduce((sum, o) => sum + o.totalCents, 0);
  }, [soldOrders]);

  const lowStockProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.status === "draft") return false;
      const { kind } = deriveProductStatus(p, threshold);
      return kind === "low";
    });
  }, [products, threshold]);

  const outOfStockProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.status === "draft") return false;
      const { kind } = deriveProductStatus(p, threshold);
      return kind === "sold_out";
    });
  }, [products, threshold]);

  function handleConfirmOrder() {
    if (!confirmTarget) return;
    const res = actions.confirmOrderProcessing(confirmTarget.id, deliveryDays);
    if (res.ok) {
      toast.push(`تم تأكيد أوردر ${confirmTarget.number} وبدء الشحن وإرسال إيميل المواعيد للعميل بنجاح.`);
    } else {
      toast.push(`تعذر تأكيد الأوردر: ${ADMIN_STRINGS.errors[res.error] || res.error}`);
    }
    setConfirmTarget(null);
  }

  function handleCompleteDelivery() {
    if (!deliverTarget) return;
    const res = actions.completeOrderDelivery(deliverTarget.id);
    if (res.ok) {
      toast.push(`تم اكتمال تسليم أوردر ${deliverTarget.number} وتحصيله، وإرسال إيميل الشكر ودعوة واتساب VIP للعميل بنجاح!`);
    } else {
      toast.push(`تعذر تأكيد التسليم: ${ADMIN_STRINGS.errors[res.error] || res.error}`);
    }
    setDeliverTarget(null);
  }

  function handleQuickCancel() {
    if (!cancelTarget) return;
    const res = actions.cancelOrder(cancelTarget.id, cancelReason);
    if (res.ok) {
      toast.push(`تم إلغاء الطلب ${cancelTarget.number}.`);
    } else {
      toast.push(`تعذر الإلغاء: ${ADMIN_STRINGS.errors[res.error] || res.error}`);
    }
    setCancelTarget(null);
    setCancelReason("");
  }

  if (!ready || !data) {
    return (
      <div className="adm-skeleton" role="status">
        <span className="adm-sr">{ADMIN_STRINGS.common.loading}</span>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={ADMIN_STRINGS.pages.dashboard.title}
        description={ADMIN_STRINGS.pages.dashboard.summary}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link className="adm-btn adm-btn-primary" href={adminHref("/sales/new")}>
              + تسجيل بيع يدوي
            </Link>
            <Link className="adm-btn adm-btn-secondary" href={adminHref("/products/new")}>
              + إضافة منتج
            </Link>
          </div>
        }
      />

      {/* Instant Push Notifications Banner */}
      <div className="mt-6">
        <AdminPushToggle />
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <div
          className={`p-4 rounded border ${
            needsActionOrders.length > 0
              ? "border-obsidian bg-obsidian text-off-white"
              : "border-line-light bg-off-white"
          }`}
        >
          <div
            className={`text-xs uppercase font-bold tracking-wider ${
              needsActionOrders.length > 0 ? "text-off-white/70" : "text-graphite"
            }`}
          >
            طلبات تحتاج إجراء
          </div>
          <div className="text-3xl font-extrabold font-mono mt-1">{needsActionOrders.length}</div>
          <div
            className={`text-xs mt-1 ${
              needsActionOrders.length > 0 ? "text-off-white/80" : "text-graphite"
            }`}
          >
            {needsActionOrders.length > 0
              ? "طلبات بانتظار قرارك للموافقة أو الإلغاء"
              : "جميع الطلبات محدثة"}
          </div>
        </div>

        <StatCard
          label="المبيعات المؤكدة"
          value={formatMoney(totalRevenueCents)}
          hint={`${soldOrders.length} طلب مكتمل ومؤكد`}
        />

        <StatCard
          label="تنبيهات انخفاض المخزون"
          value={String(lowStockProducts.length)}
          hint={
            lowStockProducts.length > 0
              ? `متبقي ${threshold} قطع أو أقل`
              : "حالة المخزون ممتازة"
          }
        />

        <StatCard
          label="إجمالي المنتجات في الكتالوج"
          value={String(products.length)}
          hint={`${outOfStockProducts.length} نفد مخزونها`}
        />
      </div>

      {/* Section 1: Orders Needing Action (Rich Cards with Product Image & Customer Details) */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-obsidian flex items-center gap-2">
              <span>طلبات تنتظر قرارك</span>
              {needsActionOrders.length > 0 && (
                <span className="bg-red-600 text-white text-[11px] font-black px-2 py-0.5 rounded-full font-mono">
                  {needsActionOrders.length}
                </span>
              )}
            </h2>
            <p className="text-xs text-graphite">
              طلبات أتمها العملاء عبر الموقع وتنتظر موافقتك لخصم القطع من المخزن وتأكيد الشحن.
            </p>
          </div>
          {needsActionOrders.length > 0 && (
            <Link
              href={adminHref("/orders")}
              className="text-xs font-semibold text-graphite hover:text-obsidian underline"
            >
              عرض كل الطلبات ←
            </Link>
          )}
        </div>

        {needsActionOrders.length === 0 ? (
          <div className="rounded border border-line-light bg-off-white p-8 text-center">
            <p className="text-sm font-semibold text-obsidian">كل شيء تمام!</p>
            <p className="text-xs text-graphite mt-1">لا توجد طلبات معلقة تحتاج لاتخاذ قرار حالياً.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {needsActionOrders.map((o) => {
              const cleanPhone = o.customer.phone.replace(/\D/g, "");
              const waLink = `https://wa.me/20${cleanPhone.replace(/^0+/, "")}?text=${encodeURIComponent(
                `أهلاً بك يا ${o.customer.name} في TERRA HOP! بخصوص طلبك رقم ${o.number}...`
              )}`;

              return (
                <div
                  key={o.id}
                  className="rounded-lg border border-line-light bg-off-white p-5 shadow-sm transition-all hover:border-obsidian/40 space-y-4"
                >
                  {/* Top Bar: Order Number, Badge, Date, Total */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-light pb-3">
                    <div className="flex items-center gap-2.5">
                      <Link
                        href={adminHref(`/orders/${o.id}`)}
                        className="font-mono text-base font-extrabold text-obsidian hover:underline"
                      >
                        {o.number}
                      </Link>
                      <StatusBadge kind={o.status} />
                      <span className="text-xs text-graphite font-mono">
                        {new Date(o.createdAt).toLocaleDateString("ar-EG", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-graphite block">إجمالي الحساب شامل الشحن</span>
                      <span className="font-mono text-lg font-black text-obsidian">
                        {formatMoney(o.totalCents)}
                      </span>
                    </div>
                  </div>

                  {/* Body Grid: Customer Info & Items with Image */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 py-2">
                    {/* Customer Info (5 cols) */}
                    <div className="md:col-span-5 space-y-2.5 border-b md:border-b-0 md:border-l md:border-line-light md:pl-5 pb-4 md:pb-0">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-graphite block">
                          بيانات العميل
                        </span>
                        <h4 className="text-sm font-bold text-obsidian mt-0.5">{o.customer.name}</h4>
                      </div>

                      {/* Phone & Contact Buttons */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-obsidian">
                          {o.customer.phone}
                        </span>
                        <a
                          href={`tel:${o.customer.phone}`}
                          title="اتصال هاتفي"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold bg-line-light hover:bg-line-light/80 text-obsidian px-2 py-0.5 rounded transition-colors"
                        >
                          <Phone size={12} />
                          اتصال
                        </a>
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="محادثة واتساب"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded transition-colors"
                        >
                          <MessageCircle size={12} />
                          واتساب
                        </a>
                      </div>

                      {/* Detailed Address */}
                      <div className="flex items-start gap-1.5 text-xs text-graphite">
                        <MapPin size={14} className="shrink-0 text-obsidian mt-0.5" />
                        <div>
                          <strong className="text-obsidian">{o.customer.city}:</strong> {o.customer.address}
                        </div>
                      </div>

                      {/* Customer Notes */}
                      {o.notes && (
                        <div className="text-xs italic bg-white/70 border border-line-light/60 p-2 rounded text-obsidian">
                          💬 &quot;{o.notes}&quot;
                        </div>
                      )}
                    </div>

                    {/* Ordered Products with Images (7 cols) */}
                    <div className="md:col-span-7 space-y-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-graphite block">
                        القطع المطلوبة ({o.items.reduce((s, it) => s + it.qty, 0)} قطعة)
                      </span>

                      <div className="space-y-2">
                        {o.items.map((it, idx) => {
                          const imgSrc = getItemImage(it.productName, it.colorName, it.productId);
                          return (
                            <div
                              key={idx}
                              className="flex items-center gap-3 bg-white p-2.5 rounded border border-line-light"
                            >
                              {/* Product Thumbnail with Streetwear Look */}
                              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded bg-charcoal/10 border border-line-light">
                                <img
                                  src={imgSrc}
                                  alt={it.productName}
                                  className="h-full w-full object-cover object-top"
                                />
                              </div>

                              {/* Item Details */}
                              <div className="flex-1 min-w-0">
                                <h5 className="text-xs font-bold text-obsidian truncate">
                                  {it.productName}
                                </h5>
                                <div className="text-[11px] text-graphite flex flex-wrap gap-x-2 mt-0.5">
                                  <span>المقاس: <strong className="text-obsidian">{it.size}</strong></span>
                                  <span>·</span>
                                  <span>اللون: <strong className="text-obsidian">{it.colorName}</strong></span>
                                  <span>·</span>
                                  <span>الكمية: <strong className="text-obsidian">{it.qty}</strong></span>
                                </div>
                              </div>

                              {/* Price snapshot */}
                              <div className="text-right shrink-0">
                                <span className="font-mono text-xs font-bold text-obsidian">
                                  {formatMoney(it.priceCentsSnapshot * it.qty)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="border-t border-line-light pt-3 flex flex-wrap items-center justify-between gap-3">
                    <Link
                      href={adminHref(`/orders/${o.id}`)}
                      className="text-xs font-semibold text-graphite hover:text-obsidian inline-flex items-center gap-1 underline underline-offset-4"
                    >
                      عرض تفاصيل الفاتورة وتاريخ الطلب
                      <ArrowUpRight size={13} />
                    </Link>

                    <div className="flex items-center gap-2.5">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setCancelTarget(o)}
                        className="text-xs py-2 px-3.5 border-line-light hover:border-red-600 hover:text-red-600 transition-colors cursor-pointer"
                      >
                        إلغاء الطلب
                      </Button>

                      {o.status === "PROCESSING" ? (
                        <Button
                          type="button"
                          onClick={() => setDeliverTarget(o)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-4 shadow-sm flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle size={15} />
                          اكتمال تسليم الأوردر
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          onClick={() => {
                            setDeliveryDays("خلال 48 ساعة");
                            setConfirmTarget(o);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-4 shadow-sm flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle size={15} />
                          تأكيد الأوردر وبدء الشحن
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 2: Low Stock Inventory Alerts */}
      <section className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-obsidian">تنبيهات المخزون المنخفض</h2>
            <p className="text-xs text-graphite">
              منتجات أوشكت على النفاد في المستودع (الكمية متبقي منها {threshold} قطع أو أقل).
            </p>
          </div>
          <Link
            href={adminHref("/products")}
            className="text-xs font-semibold text-graphite hover:text-obsidian underline"
          >
            إدارة المخزون والمنتجات ←
          </Link>
        </div>

        {lowStockProducts.length === 0 ? (
          <div className="rounded border border-line-light bg-off-white p-6 text-center text-xs text-graphite">
            ✓ لا توجد تحذيرات للمخزون. جميع المنتجات النشطة يتوفر منها كميات كافية في المستودع.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {lowStockProducts.map((p) => {
              const stock = productTotalStock(p);
              return (
                <div
                  key={p.id}
                  className="rounded border border-line-light bg-off-white p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={adminHref(`/products/${p.id}`)}
                        className="font-bold text-sm text-obsidian hover:underline"
                      >
                        {p.name}
                      </Link>
                      <StatusBadge kind="low" left={stock} />
                    </div>
                    <div className="text-xs text-graphite mt-1">
                      السعر: {formatMoney(p.priceCents)}
                    </div>
                    <div className="font-mono text-xs font-bold text-charcoal mt-2">
                      إجمالي المتبقي: {stock} قطعة
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-line-light flex items-center justify-end">
                    <Link
                      href={adminHref(`/products/${p.id}`)}
                      className="text-xs font-semibold text-obsidian underline hover:text-graphite"
                    >
                      تزويد المخزون / تعديل ←
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Confirmation Dialog: Step 1 - Confirm Order & Ship */}
      <Dialog
        open={confirmTarget !== null}
        onClose={() => setConfirmTarget(null)}
        title={confirmTarget ? `تأكيد أوردر ${confirmTarget.number} وبدء الشحن` : ""}
      >
        {confirmTarget && (
          <div className="space-y-4">
            <p className="text-sm text-graphite">
              سيتم تغيير حالة الطلب إلى <strong className="text-obsidian">مؤكد وقيد الشحن</strong> وإرسال إيميل رسمي تلقائي للعميل بجدول التوصيل.
            </p>
            <div className="rounded border border-line-light bg-off-white p-3 text-xs space-y-1.5">
              <div className="font-semibold text-obsidian">القطع في هذا الطلب:</div>
              {confirmTarget.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-charcoal">
                  <span>
                    {item.productName} ({item.colorName} / {item.size})
                  </span>
                  <span className="font-mono font-bold text-obsidian">× {item.qty}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-line-light">
              <TextInput
                label="موعد التوصيل المتوقع (يُرسل في إيميل الشحن للعميل)"
                value={deliveryDays}
                onChange={(e) => setDeliveryDays(e.target.value)}
                placeholder="مثال: خلال 48 ساعة"
              />
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {["خلال 48 ساعة", "من 2 إلى 3 أيام عمل", "من 3 إلى 5 أيام عمل"].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDeliveryDays(d)}
                    className="text-[11px] px-2 py-0.5 rounded bg-line-light hover:bg-line-light/80 text-obsidian font-semibold cursor-pointer"
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setConfirmTarget(null)}>
                إلغاء
              </Button>
              <Button type="button" onClick={handleConfirmOrder}>
                تأكيد الأوردر وبدء الشحن
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Confirmation Dialog: Step 2 - Complete Order Delivery & COD Paid */}
      <Dialog
        open={deliverTarget !== null}
        onClose={() => setDeliverTarget(null)}
        title={deliverTarget ? `اكتمال تسليم الأوردر: ${deliverTarget.number}` : ""}
      >
        {deliverTarget && (
          <div className="space-y-4">
            <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
              تأكيد أن مندوب الشحن سلّم الشحنة للعميل وحصّل المبلغ نقداً. سيتم تسجيل المبيعة والتحصيل، وتأكيد عمولة السفير، وإرسال رسالة شكر للعميل برابط جروب واتساب VIP.
            </div>

            <div className="rounded border border-line-light bg-off-white p-3 text-xs space-y-1.5">
              <div className="flex justify-between text-charcoal">
                <span>العميل:</span>
                <span className="font-bold text-obsidian">{deliverTarget.customer.name}</span>
              </div>
              <div className="flex justify-between text-charcoal">
                <span>المبلغ المطلوب استلامه (نقداً):</span>
                <span className="font-mono font-bold text-obsidian text-sm">
                  {formatMoney(deliverTarget.totalCents)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setDeliverTarget(null)}>
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={handleCompleteDelivery}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                تأكيد اكتمال التسليم والتحصيل
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Confirmation Dialog: Quick Cancel */}
      <Dialog
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title={cancelTarget ? `إلغاء الطلب: ${cancelTarget.number}` : ""}
      >
        {cancelTarget && (
          <div className="space-y-4">
            <p className="text-sm text-graphite">
              هل أنت متأكد من رغبتك في إلغاء هذا الطلب؟ سيتم تغيير حالته إلى ملغي.
            </p>
            <TextInput
              label="سبب الإلغاء (اختياري)"
              placeholder="مثال: نفاد الكمية، أو بناء على طلب العميل"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setCancelTarget(null)}>
                الإبقاء على الطلب
              </Button>
              <Button type="button" variant="secondary" onClick={handleQuickCancel}>
                تأكيد الإلغاء
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
