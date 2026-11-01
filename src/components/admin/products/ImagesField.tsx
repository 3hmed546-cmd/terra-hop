"use client";
import { useId, useRef, useState } from "react";
import { ADMIN_STRINGS } from "@/lib/admin/admin-strings";
import { resizeImageToDataUrl } from "@/lib/admin/image-resize";
import { MAX_IMAGES } from "@/lib/admin/product-form";
import type { ProductImage } from "@/lib/admin/types";
import { Button, TextInput } from "../ui";

const I = ADMIN_STRINGS.productForm.images;

interface Props {
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
}

/** Local-only image list: add, describe (alt), reorder with buttons, remove. First image is the main one. */
export function ImagesField({ images, onChange }: Props) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const full = images.length >= MAX_IMAGES;

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const messages: string[] = [];
    const room = MAX_IMAGES - images.length;
    const picked = Array.from(files);
    const usable = picked.filter((f) => {
      if (f.type.startsWith("image/")) return true;
      messages.push(I.notImage(f.name));
      return false;
    });
    if (usable.length > room) messages.push(I.tooMany(room));
    setBusy(true);
    const added: ProductImage[] = [];
    for (const [i, file] of usable.slice(0, room).entries()) {
      try {
        added.push({ id: `img-${Date.now().toString(36)}-${i}`, url: await resizeImageToDataUrl(file), alt: "" });
      } catch {
        messages.push(I.unreadable(file.name));
      }
    }
    setBusy(false);
    setNotes(messages);
    if (added.length) onChange([...images, ...added]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const move = (index: number, by: -1 | 1) => {
    const next = [...images];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  };

  return (
    <div className="adm-stack">
      <p className="adm-muted adm-nomargin">{I.hint}</p>
      <div className="adm-row">
        <input
          ref={fileRef}
          id={inputId}
          className="adm-sr"
          type="file"
          accept="image/*"
          multiple
          disabled={full || busy}
          onChange={(e) => void addFiles(e.target.files)}
        />
        <label htmlFor={inputId} className={`adm-btn adm-btn-secondary adm-file-label${full || busy ? " is-disabled" : ""}`} aria-disabled={full || busy}>
          {I.add}
        </label>
        <span className="adm-muted" role="status">
          {I.count(images.length, MAX_IMAGES)}
          {full ? ` · ${I.full}` : ""}
        </span>
      </div>
      {notes.length > 0 ? (
        <ul className="adm-notes" role="status">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}

      {images.length > 0 ? (
        <ul className="adm-images">
          {images.map((img, i) => (
            <li key={img.id} className="adm-image-item">
              <div className="adm-image-preview" role="img" aria-label={I.preview(i + 1)} style={{ backgroundImage: `url(${JSON.stringify(img.url)})` }}>
                {i === 0 ? <span className="adm-badge adm-badge-available">{I.main}</span> : null}
              </div>
              <TextInput
                label={I.alt(i + 1)}
                hint={I.altHint}
                value={img.alt}
                maxLength={140}
                onChange={(e) => onChange(images.map((x) => (x.id === img.id ? { ...x, alt: e.target.value } : x)))}
              />
              <div className="adm-row-links">
                <Button variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label={I.earlier(i + 1)}>
                  ←
                </Button>
                <Button variant="ghost" disabled={i === images.length - 1} onClick={() => move(i, 1)} aria-label={I.later(i + 1)}>
                  →
                </Button>
                <Button variant="ghost" onClick={() => onChange(images.filter((x) => x.id !== img.id))} aria-label={I.remove(i + 1)}>
                  {ADMIN_STRINGS.products.delete}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
