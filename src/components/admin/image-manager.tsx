"use client";

import { useId, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import type { FieldErrors, ImageInput } from "@/lib/admin/types";
import { TextField, useErrorText } from "./form";

async function upload(file: File, folder: "places" | "events"): Promise<{ ok: true; image: ImageInput } | { ok: false; code: string }> {
  const fd = new FormData();
  fd.set("folder", folder);
  fd.set("file", file);
  try {
    const res = await fetch("/api/uploads", { method: "POST", body: fd });
    const data = (await res.json().catch(() => ({}))) as { url?: string; width?: number; height?: number; error?: string };
    if (!res.ok || !data.url) return { ok: false, code: data.error ?? "generic" };
    return {
      ok: true,
      image: { url: data.url, width: data.width ?? null, height: data.height ?? null, alt: "", author: "", license: "", licenseUrl: "", sourceUrl: "", origin: "upload" },
    };
  } catch {
    return { ok: false, code: "generic" };
  }
}

/**
 * Uploads images and edits their credits. Every image must carry an author
 * and a licence (validated on the server); order can be changed with the
 * move buttons, and the first image is the cover.
 */
export function ImageManager({
  images,
  onChange,
  folder,
  max = 12,
  errors,
  prefix,
  scope,
}: {
  images: ImageInput[];
  onChange: (images: ImageInput[]) => void;
  folder: "places" | "events";
  max?: number;
  errors: FieldErrors;
  /** Error key prefix, e.g. "images" → images.0.author; "image" for a single image */
  prefix: string;
  /** Makes field ids unique when several image managers share a page */
  scope?: string;
}) {
  const { t } = useI18n();
  const a = t.admin.places;
  const err = useErrorText();
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const single = max === 1;
  const key = (i: number, f: string) => (single ? `${prefix}.${f}` : `${prefix}.${i}.${f}`);
  const fname = (i: number, f: string) => (scope ? `${scope}-${key(i, f)}` : key(i, f));

  const update = (i: number, patch: Partial<ImageInput>) => onChange(images.map((img, j) => (j === i ? { ...img, ...patch } : img)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...images];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setUploadError(null);
    let next = [...images];
    for (const file of Array.from(files).slice(0, Math.max(0, max - images.length) || 1)) {
      const r = await upload(file, folder);
      if (!r.ok) {
        setUploadError(r.code === "too_large" ? t.admin.common.uploadTooLarge : r.code === "unsupported_type" || r.code === "unreadable_image" ? t.admin.common.uploadType : t.admin.common.uploadFailed);
        break;
      }
      next = single ? [r.image] : [...next, r.image];
    }
    onChange(next);
    setBusy(false);
  };

  const canAdd = single || images.length < max;

  return (
    <div className="space-y-4">
      {images.length === 0 && !single && <p className="text-sm text-ink-500">{a.imagesEmpty}</p>}
      <ul className="space-y-4">
        {images.map((img, i) => (
          // Container queries: the manager is used both full-width and in narrow columns.
          <li key={img.url} className="@container rounded-2xl border border-sand-200 bg-sand-50 p-3 md:p-4">
            <div className="flex flex-col gap-4 @xl:flex-row">
              <div className="relative aspect-[4/3] w-full max-w-xs shrink-0 overflow-hidden rounded-xl bg-sand-200 @xl:w-44">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt || ""} className="size-full object-cover" />
                {!single && i === 0 && (
                  <span className="absolute start-2 top-2 rounded-md bg-ink-900/80 px-2 py-0.5 text-[11px] font-medium text-white">{a.imageCover}</span>
                )}
              </div>
              <div className="grid min-w-0 flex-1 gap-3 @2xl:grid-cols-2">
                <TextField
                  name={fname(i, "author")}
                  label={a.imageAuthor}
                  required
                  value={img.author}
                  onChange={(v) => update(i, { author: v })}
                  error={err(errors[key(i, "author")])}
                />
                <TextField
                  name={fname(i, "license")}
                  label={a.imageLicense}
                  hint={a.imageLicenseHint}
                  required
                  value={img.license}
                  onChange={(v) => update(i, { license: v })}
                  error={err(errors[key(i, "license")])}
                />
                <TextField
                  name={fname(i, "sourceUrl")}
                  label={a.imageSource}
                  type="url"
                  dir="ltr"
                  placeholder="https://"
                  value={img.sourceUrl}
                  onChange={(v) => update(i, { sourceUrl: v })}
                  error={err(errors[key(i, "sourceUrl")])}
                />
                <TextField
                  name={fname(i, "licenseUrl")}
                  label={a.imageLicenseUrl}
                  type="url"
                  dir="ltr"
                  placeholder="https://"
                  value={img.licenseUrl}
                  onChange={(v) => update(i, { licenseUrl: v })}
                  error={err(errors[key(i, "licenseUrl")])}
                />
                <TextField
                  name={fname(i, "alt")}
                  label={a.imageAlt}
                  className="@2xl:col-span-2"
                  value={img.alt ?? ""}
                  onChange={(v) => update(i, { alt: v })}
                  maxLength={200}
                />
                {errors[key(i, "url")] && <p className="text-[13px] font-medium text-coral-500 @2xl:col-span-2">{err(errors[key(i, "url")])}</p>}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap justify-end gap-1.5 border-t border-sand-200 pt-3">
              {!single && (
                <>
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-ink-700 ring-1 ring-sand-300 hover:bg-white disabled:opacity-40"
                  >
                    <ArrowUp className="size-4" aria-hidden /> {t.admin.common.moveUp}
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === images.length - 1}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-ink-700 ring-1 ring-sand-300 hover:bg-white disabled:opacity-40"
                  >
                    <ArrowDown className="size-4" aria-hidden /> {t.admin.common.moveDown}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => onChange(images.filter((_, j) => j !== i))}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-coral-500 ring-1 ring-coral-400/40 hover:bg-coral-400/10"
              >
                <Trash2 className="size-4" aria-hidden /> {t.admin.common.remove}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {canAdd && (
        <div>
          <label
            htmlFor={inputId}
            className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-white px-5 text-[15px] font-medium ring-1 ring-sand-300 transition hover:ring-ink-300 focus-within:ring-2 focus-within:ring-sea-400 ${busy ? "pointer-events-none opacity-60" : ""}`}
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
            {busy ? t.admin.common.uploading : single && images.length ? t.common.replace : t.admin.common.upload}
            <input
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple={!single}
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                void onFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <p className="mt-1.5 text-xs text-ink-500">{t.admin.common.uploadHint}</p>
          {uploadError && (
            <p role="alert" className="mt-1 text-[13px] font-medium text-coral-500">
              {uploadError}
            </p>
          )}
          {errors[prefix] && <p className="mt-1 text-[13px] font-medium text-coral-500">{err(errors[prefix])}</p>}
        </div>
      )}
    </div>
  );
}
