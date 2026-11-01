import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";
import type { DerivedProductStatus, OrderStatus } from "@/lib/admin/types";

export type BadgeKind = DerivedProductStatus | OrderStatus;

const S = ADMIN_STRINGS.status;

/** Status is always written out and given its own shape, so colour is never the only signal. */
export function StatusBadge({ kind, left }: { kind: BadgeKind; left?: number }) {
  switch (kind) {
    case "available":
      return <span className="adm-badge adm-badge-available">{S.available}</span>;
    case "low":
      return <span className="adm-badge adm-badge-low">{S.low(left ?? 0)}</span>;
    case "sold_out":
      return (
        <span className="adm-badge adm-badge-sold_out">
          <s>{S.soldOutStruck}</s>
          {S.soldOutRest}
        </span>
      );
    case "draft":
      return <span className="adm-badge adm-badge-draft">{S.draft}</span>;
    case "PENDING_EMAIL":
      return <span className="adm-badge adm-badge-pending">{S.pendingEmail}</span>;
    case "AWAITING_APPROVAL":
      return <span className="adm-badge adm-badge-needs">{S.needsAction}</span>;
    case "SOLD":
      return <span className="adm-badge adm-badge-sold">{S.sold}</span>;
    case "CANCELLED":
      return <span className="adm-badge adm-badge-cancelled">{S.cancelled}</span>;
    case "EXPIRED":
      return <span className="adm-badge adm-badge-cancelled">{S.expired}</span>;
  }
}
