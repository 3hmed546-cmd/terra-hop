# TERRA HOP Admin Dashboard (Frontend Preview)

Complete, fully-functional frontend implementation of the TERRA HOP Admin Dashboard, built strictly according to `Terra_Hop_Admin_Dashboard_Plan_(2).md` and the 6 design system tokens.

---

## 1. Access & Secret Route

- **Secret Admin URL:** [`http://localhost:3000/k7q2-vault-9xm4`](http://localhost:3000/k7q2-vault-9xm4)
- **Direct Route Protection:** Direct access to `/admin` and `/admin-login` returns `404 Not Found`.
- **Environment Variables:**
  - `ADMIN_PATH=k7q2-vault-9xm4`
  - `NEXT_PUBLIC_ADMIN_PATH=k7q2-vault-9xm4`

---

## 2. Completed Stages (A0 to A5)

### Stage A0: Foundation & Core Design System
- Shell layout with responsive desktop sidebar (`240px`) and mobile drawer.
- Pure state store (`src/lib/admin/store.ts`) synchronized with `localStorage` (key: `terra-hop-admin-preview`).
- Design tokens defined in `src/app/admin/admin.css` (`#080808`, `#F4F1EB`, `#242424`, `#929292`, `#5E5E5E`).
- Reusable UI kit: `Table`, `Tabs`, `Dialog`, `TextInput`, `NumberInput`, `Select`, `StatusBadge`, `StatCard`, `Toast`, `EmptyState`.

### Stage A1: Products List & Real-time Status
- Comprehensive product catalog table with thumbnail, title, category, formatted price, stock count, and status badge.
- Search by name, slug, or category.
- Status filter tabs (`All`, `Available`, `Low stock`, `Sold out`, `Draft`) with dynamic counts.
- Quick status dropdown (`Available`, `Sold out`, `Draft`) with safety barrier preventing `Available` when total stock is 0.
- Product deletion with confirmation dialog and open-order warning.

### Stage A2: Add & Edit Product Form
- Form covering basics (Name, auto-generating unique slug, description, category).
- EGP pricing with optional compare-at price validation.
- Image management: up to 8 images with client-side compression, alt descriptions, and reordering.
- Color & Size grid: matrix of variants with real-time total calculations per color and product-wide.
- Unsaved changes guard preventing accidental navigation.
- Duplicate action creating a fresh draft with 0 inventory.

### Stage A3: Orders & Stock Decision Engine
- Orders listing at `/<ADMIN_PATH>/orders` with 5 status tabs (`All`, `Needs action`, `Pending email`, `Sold`, `Cancelled`).
- Quick actions for `AWAITING_APPROVAL`: [ Mark as sold ] and [ Cancel ].
- Order detail page at `/<ADMIN_PATH>/orders/[id]`:
  - Customer contact details (`tel:` and `mailto:` links).
  - Ordered items list and pricing calculation.
  - **Live Inventory Check Engine**: compares ordered quantities against available warehouse stock. If any variant is out of stock, "Mark as sold" is safely disabled with an explanatory banner.
  - Confirmation dialogs for "Mark as sold" (deducts stock) and "Cancel" (restores stock if status was `SOLD`).
  - Immutable timeline displaying placement, confirmation, and owner actions.
- Interactive simulation buttons: `+ Simulate (Needs action)` and `+ Simulate (Pending email)`.

### Stage A4: Manual Sale, Stock Log & Dashboard Overview
- **Dashboard Overview (`/<ADMIN_PATH>/dashboard`):**
  - 4 KPI cards: Orders needing action, Confirmed sales (count + EGP), Low stock alerts, Total catalog items.
  - Top action buttons: `+ Record a sale` and `+ Add product`.
  - "Orders Needing Action" card feed with inline [ Mark as sold ] and [ Cancel ] controls.
  - "Low Stock Alerts" grid highlighting products at or below the warning threshold with one-click restock links.
- **Manual Sale (`/<ADMIN_PATH>/sales/new`):**
  - Form to record direct sales (exhibitions, pop-ups, social media direct orders).
  - Product and variant dropdowns displaying live available warehouse stock and remaining balance after sale.
  - Quantity and price inputs (with catalog price default).
  - Generates an immediate `SOLD` order with source `manual` and deducts stock.
- **Stock Log & Quick Restock (`/<ADMIN_PATH>/products/[id]`):**
  - Dedicated "Stock movements log" tab within product details.
  - Chronological history of every stock change (`initial`, `sale`, `cancel_restock`, `manual_adjust`) with variant and delta.
  - Quick Restock dialog to adjust variant stock directly with a required audit note.

### Stage A5: Settings & Polish
- **Settings (`/<ADMIN_PATH>/settings`):**
  - Store profile (Store name, currency, default shipping fee).
  - Inventory policies (Low stock threshold, reservation policy option 1 vs option 2, confirmation token expiry).
  - Interactive customer email template preview.
  - Secret path information and admin password change UI.
  - "Reset demo data" button with confirmation dialog restoring all initial seed products and orders.

---

## 3. Backend Integration Guide (When Transitioning to B0-B6)

When backend APIs are implemented, only the action dispatchers in `src/lib/admin/store.ts` need to be updated:
- Replace `actions.sellOrder` with `POST /api/admin/orders/:id/sell`
- Replace `actions.cancelOrder` with `POST /api/admin/orders/:id/cancel`
- Replace `actions.recordSale` with `POST /api/admin/sales`
- Replace `actions.adjustStock` with `POST /api/admin/variants/:id/stock`
- Replace `actions.saveProduct` with `POST/PATCH /api/admin/products`
- Replace `actions.deleteProduct` with `DELETE /api/admin/products/:id`

All UI components, validations, dialogs, and page routes remain 100% untouched.
