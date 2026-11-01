export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="adm-card">
      <div className="adm-label adm-muted">{label}</div>
      <div className="adm-stat-value">{value}</div>
      {hint ? <div className="adm-muted">{hint}</div> : null}
    </div>
  );
}
