import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth-middleware";
import { getDb } from "@/lib/server/db";
import { decryptCustomer } from "@/lib/server/vault";
import { generateCode128Svg } from "@/lib/server/barcode";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request);
  if (!auth.authenticated || !auth.user) {
    return new NextResponse(
      "<!DOCTYPE html><html><body style='font-family:sans-serif;text-align:center;padding:50px;'><h2>غير مصرح. يرجى تسجيل الدخول إلى لوحة التحكم أولاً.</h2></body></html>",
      { status: 401, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const { id } = await context.params;
  const db = getDb();

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as any;
  if (!order) {
    return new NextResponse(
      "<!DOCTYPE html><html><body style='font-family:sans-serif;text-align:center;padding:50px;'><h2>الطلب غير موجود.</h2></body></html>",
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // Decrypt customer details
  let customer: any = { name: "عميل", phone: "", city: "", address: "" };
  try {
    if (order.customer_enc) {
      const dec = decryptCustomer(Buffer.from(order.customer_enc));
      if (dec) customer = dec;
    }
  } catch (err) {
    console.error("[WAYBILL] Decrypt customer failed:", err);
  }

  // Fallback to customer_phone column if present
  if (!customer.phone && order.customer_phone) {
    customer.phone = order.customer_phone;
  }

  // Fetch items
  const items = db
    .prepare("SELECT * FROM order_items WHERE order_id = ?")
    .all(order.id) as any[];

  // Format currency
  const formatMoney = (cents: number) => {
    return (cents / 100).toLocaleString("ar-EG") + " ج.م";
  };

  const barcodeSvg = generateCode128Svg(order.number || `TH-${order.id.slice(0, 4)}`);

  const orderDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleDateString("ar-EG");

  const subtotalCents = order.subtotal_cents || items.reduce((sum, it) => sum + (it.price_cents_snapshot || 0) * (it.qty || 1), 0);
  const shippingCents = order.shipping_cents || 0;
  const discountCents = order.discount_cents || 0;
  const totalCents = order.total_cents || (subtotalCents + shippingCents - discountCents);

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>بوليصة شحن - ${order.number} | TERRA HOP</title>
  <style>
    @page {
      size: 100mm 150mm;
      margin: 4mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Cairo", Arial, sans-serif;
      font-size: 11px;
      line-height: 1.35;
      color: #000000;
      background: #ffffff;
      padding: 6px;
    }
    .no-print {
      background: #111111;
      color: #ffffff;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      border-radius: 6px;
    }
    .no-print button {
      background: #ffffff;
      color: #000000;
      border: none;
      padding: 7px 18px;
      font-weight: 700;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    .no-print button.btn-secondary {
      background: transparent;
      color: #e5e5e5;
      border: 1px solid #444444;
      margin-right: 8px;
    }
    @media print {
      .no-print {
        display: none !important;
      }
      body {
        padding: 0;
      }
      .waybill-wrapper {
        border: none !important;
      }
    }
    .waybill-wrapper {
      max-width: 420px;
      margin: 0 auto;
      border: 2px solid #000000;
      padding: 10px 12px;
      background: #ffffff;
    }
    /* Header */
    .header-table {
      width: 100%;
      border-bottom: 2px solid #000000;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: 2px;
      text-transform: uppercase;
      line-height: 1.1;
    }
    .brand-sub {
      font-size: 9px;
      font-weight: 700;
      color: #444444;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .invoice-title {
      font-size: 12px;
      font-weight: 800;
      text-align: left;
    }
    .invoice-num {
      font-size: 15px;
      font-weight: 900;
      font-family: monospace;
      text-align: left;
      letter-spacing: 1px;
    }
    .invoice-date {
      font-size: 9px;
      color: #555555;
      text-align: left;
    }
    /* Barcode Section */
    .barcode-container {
      text-align: center;
      padding: 6px 0;
      margin-bottom: 8px;
      border-bottom: 1px dashed #000000;
    }
    /* Section Block */
    .section-box {
      border: 1px solid #000000;
      margin-bottom: 8px;
      border-radius: 3px;
      overflow: hidden;
    }
    .section-header {
      background: #000000;
      color: #ffffff;
      padding: 3px 8px;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      justify-content: space-between;
    }
    .section-body {
      padding: 6px 8px;
      background: #ffffff;
    }
    .cust-row {
      margin-bottom: 3px;
      display: flex;
    }
    .cust-label {
      width: 65px;
      font-weight: 700;
      color: #333333;
      flex-shrink: 0;
    }
    .cust-val {
      font-weight: 800;
      flex-grow: 1;
    }
    .cust-val.phone {
      direction: ltr;
      text-align: right;
      font-family: monospace;
      font-size: 12px;
    }
    /* Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-top: 2px;
    }
    .items-table th {
      background: #f0f0f0;
      border-bottom: 1px solid #000000;
      padding: 4px 6px;
      text-align: right;
      font-weight: 700;
    }
    .items-table td {
      border-bottom: 1px solid #e0e0e0;
      padding: 5px 6px;
      vertical-align: middle;
    }
    .item-name {
      font-weight: 700;
    }
    .item-specs {
      font-size: 9px;
      color: #555555;
      margin-top: 1px;
    }
    /* COD Box */
    .cod-box {
      background: #f8f8f8;
      border: 2px solid #000000;
      padding: 8px;
      margin-bottom: 8px;
      text-align: center;
      border-radius: 4px;
    }
    .cod-label {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .cod-amount {
      font-size: 21px;
      font-weight: 900;
      color: #000000;
      margin: 2px 0;
      letter-spacing: 0.5px;
    }
    .cod-note {
      font-size: 8.5px;
      font-weight: 600;
      color: #333333;
      border-top: 1px dashed #999999;
      padding-top: 4px;
      margin-top: 4px;
    }
    /* Financial Summary */
    .summary-table {
      width: 100%;
      margin-bottom: 8px;
      font-size: 9.5px;
    }
    .summary-table td {
      padding: 2px 4px;
    }
    /* Footer */
    .footer-section {
      border-top: 1px solid #000000;
      padding-top: 6px;
      margin-top: 4px;
      text-align: center;
    }
    .social-row {
      display: flex;
      justify-content: space-around;
      align-items: center;
      font-size: 8px;
      font-weight: 700;
      color: #222222;
      flex-wrap: wrap;
      gap: 4px;
    }
    .social-item {
      display: inline-block;
      white-space: nowrap;
    }
    .brand-tagline {
      font-size: 7.5px;
      font-weight: 600;
      color: #666666;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>

  <div class="no-print">
    <div>
      <strong>بوليصة شحن وفاتورة تسليم - TERRA HOP</strong>
      <span style="font-size:12px;color:#aaaaaa;margin-right:10px;">رقم: ${order.number}</span>
    </div>
    <div>
      <button class="btn-secondary" onclick="window.close()">إغلاق</button>
      <button onclick="window.print()">طباعة الآن</button>
    </div>
  </div>

  <div class="waybill-wrapper">
    <!-- Header -->
    <table class="header-table">
      <tr>
        <td style="vertical-align:top;">
          <div class="brand-title">TERRA HOP</div>
          <div class="brand-sub">ELEGANCE IN EVERY DETAIL</div>
          <div style="font-size:10px;font-weight:800;margin-top:4px;">بوليصة شحن وتفاصيل الأوردر</div>
        </td>
        <td style="vertical-align:top;text-align:left;">
          <div class="invoice-title">فاتورة رقم</div>
          <div class="invoice-num">${order.number}</div>
          <div class="invoice-date">${orderDate}</div>
        </td>
      </tr>
    </table>

    <!-- Barcode -->
    <div class="barcode-container">
      ${barcodeSvg}
    </div>

    <!-- Customer Section -->
    <div class="section-box">
      <div class="section-header">
        <span>بيانات المستلم (العميل)</span>
        <span>الدفع عند الاستلام</span>
      </div>
      <div class="section-body">
        <div class="cust-row">
          <span class="cust-label">الاسم:</span>
          <span class="cust-val">${customer.name || "عميل TERRA HOP"}</span>
        </div>
        <div class="cust-row">
          <span class="cust-label">الهاتف:</span>
          <span class="cust-val phone">${customer.phone || "—"}</span>
        </div>
        <div class="cust-row">
          <span class="cust-label">المحافظة:</span>
          <span class="cust-val">${customer.city || "القاهرة والجيزة"}</span>
        </div>
        <div class="cust-row">
          <span class="cust-label">العنوان:</span>
          <span class="cust-val">${customer.address || "العنوان مسجل بالطلب"}</span>
        </div>
        ${
          order.notes
            ? `<div class="cust-row">
                <span class="cust-label">ملاحظات:</span>
                <span class="cust-val" style="font-weight:600;font-size:9.5px;">${order.notes}</span>
              </div>`
            : ""
        }
      </div>
    </div>

    <!-- Order Items -->
    <div class="section-box">
      <div class="section-header">
        <span>محتويات الشحنة (${items.length} قطع)</span>
        <span>المقاس واللون</span>
      </div>
      <table class="items-table">
        <thead>
          <tr>
            <th>المنتج</th>
            <th style="text-align:center;">المقاس</th>
            <th style="text-align:center;">اللون</th>
            <th style="text-align:center;">الكمية</th>
            <th style="text-align:left;">السعر</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `
            <tr>
              <td>
                <div class="item-name">${item.product_name || "منتج TERRA HOP"}</div>
              </td>
              <td style="text-align:center;font-weight:800;font-size:11px;">${item.size || "Free"}</td>
              <td style="text-align:center;font-weight:700;">${item.color_name || "—"}</td>
              <td style="text-align:center;font-weight:800;">×${item.qty || 1}</td>
              <td style="text-align:left;font-weight:700;font-family:monospace;">${formatMoney((item.price_cents_snapshot || 0) * (item.qty || 1))}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>

    <!-- Financial Breakdown -->
    <table class="summary-table">
      <tr>
        <td style="color:#555;">إجمالي المنتجات:</td>
        <td style="text-align:left;font-family:monospace;">${formatMoney(subtotalCents)}</td>
      </tr>
      <tr>
        <td style="color:#555;">مصاريف الشحن والتوصيل:</td>
        <td style="text-align:left;font-family:monospace;">${formatMoney(shippingCents)}</td>
      </tr>
      ${
        discountCents > 0
          ? `<tr>
              <td style="color:#555;">الخصم:</td>
              <td style="text-align:left;font-family:monospace;color:#c00;">- ${formatMoney(discountCents)}</td>
            </tr>`
          : ""
      }
    </table>

    <!-- COD Box -->
    <div class="cod-box">
      <div class="cod-label">المبلغ المطلوب تحصيله عند الاستلام (COD)</div>
      <div class="cod-amount">${formatMoney(totalCents)}</div>
      <div class="cod-note">
        معاينة وتجربة الشحنة مسموحة للعميل مع المندوب قبل السداد
      </div>
    </div>

    <!-- Footer: Social Media Links Side by Side (ZERO EMOJIS) -->
    <div class="footer-section">
      <div class="social-row">
        <span class="social-item">Instagram: @terr3hop</span>
        <span style="color:#999;">|</span>
        <span class="social-item">Facebook: terrahop.wear</span>
        <span style="color:#999;">|</span>
        <span class="social-item">TikTok: @terr3hop</span>
        <span style="color:#999;">|</span>
        <span class="social-item">terra-hop.com</span>
      </div>
      <div class="brand-tagline">
        HIGHER ON PURPOSE &bull; QUALITY YOU CAN FEEL
      </div>
    </div>
  </div>

  <script>
    // Automatically trigger print dialog when opened
    window.addEventListener("load", function() {
      setTimeout(function() {
        window.print();
      }, 350);
    });
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
