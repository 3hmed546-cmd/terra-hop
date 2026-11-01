import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";

/** Shown while a page's code loads. Pages show their own skeleton while demo data loads. */
export default function AdminLoading() {
  return (
    <div className="adm-skeleton" role="status">
      <span className="adm-sr">{ADMIN_STRINGS.common.loading}</span>
    </div>
  );
}
