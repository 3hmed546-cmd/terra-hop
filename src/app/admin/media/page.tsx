import type { Metadata } from "next";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";
import { PageHeader } from "@/components/admin/PageHeader";
import { MediaGallery } from "@/components/admin/media/MediaGallery";

export const metadata: Metadata = {
  title: ADMIN_STRINGS.pages.media.title,
};

export default function MediaPage() {
  return (
    <>
      <PageHeader
        title={ADMIN_STRINGS.pages.media.title}
        description={ADMIN_STRINGS.pages.media.summary}
      />
      <div className="mt-6">
        <MediaGallery />
      </div>
    </>
  );
}
