"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button, EmptyState } from "@/components/admin/ui";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";
import { adminHref } from "@/lib/admin/paths";

const T = ADMIN_STRINGS.errorPage;

/** Shown inside the admin shell when a page throws. The navigation stays usable. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    // Phase B6 will send this to the error tracker. Never show the raw message to the owner.
    console.error(error);
  }, [error]);

  return (
    <div ref={ref} tabIndex={-1} role="alert" className="adm-sr-focus-box">
      <PageHeader title={T.title} />
      <EmptyState
        title={T.title}
        description={T.text}
        action={
          <div className="adm-row">
            <Button onClick={reset}>{T.retry}</Button>
            <Link className="adm-btn adm-btn-secondary" href={adminHref("/dashboard")}>{T.toDashboard}</Link>
          </div>
        }
      />
    </div>
  );
}
