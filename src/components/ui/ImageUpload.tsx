"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/cn";

export type ImageUploadHandle = {
  // Uploads a pending (not-yet-uploaded) file and returns its URL. When there
  // is no pending file, resolves to the current value. Throws on upload error.
  flush: () => Promise<string | null>;
};

async function uploadFile(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Upload failed");
  return json.url as string;
}

// Image picker that reports a stored URL via onChange, with a manual URL field
// as a fallback.
//
// - Default (immediate) mode: uploads on pick and reports the URL right away.
// - Deferred mode (`deferred`): shows a local preview on pick and holds the
//   file until the parent calls `flush()` (via ref) at save time, so nothing is
//   uploaded unless the form is actually saved.
export const ImageUpload = forwardRef<
  ImageUploadHandle,
  {
    label?: string;
    value: string | null;
    onChange: (url: string | null) => void;
    className?: string;
    deferred?: boolean;
    uploadLabel?: string;
    hint?: string;
  }
>(function ImageUpload(
  { label, value, onChange, className, deferred, uploadLabel, hint },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Deferred mode only: the picked-but-not-uploaded file and its object-URL preview.
  const pendingFile = useRef<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const clearPending = () => {
    pendingFile.current = null;
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  // When the value changes from outside (modal reopened, URL pasted, parent
  // reset), drop any stale pending file/preview.
  useEffect(() => {
    clearPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Revoke the last object URL on unmount.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      flush: async () => {
        if (!pendingFile.current) return value;
        setUploading(true);
        setError(null);
        try {
          const url = await uploadFile(pendingFile.current);
          clearPending();
          onChange(url);
          return url;
        } catch (e) {
          setError(e instanceof Error ? e.message : "Upload failed");
          throw e;
        } finally {
          setUploading(false);
        }
      },
    }),
    // onChange/value captured fresh each render via closure recreation
    [value, onChange],
  );

  const pick = async (file: File) => {
    setError(null);
    if (deferred) {
      pendingFile.current = file;
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      return;
    }
    setUploading(true);
    try {
      onChange(await uploadFile(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const shown = preview ?? value;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <span className="label">{label}</span>}
      <div className="flex items-center gap-3">
        <div className="relative h-14 w-14 shrink-0">
          <div
            className="flex h-full w-full items-center justify-center overflow-hidden rounded-lg border border-line bg-sand"
            style={{ borderColor: "var(--line)", background: "var(--bg-sunken)" }}
          >
            {uploading ? (
              <span className="text-[10px] text-ink-muted">…</span>
            ) : shown ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shown} alt="" className="h-full w-full object-cover" />
            ) : (
              <svg
                viewBox="0 0 24 24"
                width={22}
                height={22}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ color: "var(--ink-4, #6b6b6b)" }}
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            )}
          </div>
          {shown && !uploading && (
            <button
              type="button"
              onClick={() => {
                clearPending();
                onChange(null);
              }}
              title="Remove image"
              aria-label="Remove image"
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border shadow-sm transition-colors hover:bg-red-50 hover:text-red-600"
              style={{
                borderColor: "var(--line)",
                background: "var(--bg-elev)",
                color: "var(--ink)",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width={12}
                height={12}
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-label={uploadLabel ?? "Upload image"}
            className="inline-flex items-center gap-2 self-start rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-wait"
            style={{
              border: "1px solid var(--line-strong, var(--line))",
              background: "var(--bg-elev)",
              color: "var(--ink)",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width={13}
              height={13}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 19V6" />
              <path d="M5 12l7-7 7 7" />
            </svg>
            {uploading ? "Uploading…" : (uploadLabel ?? "Upload image")}
          </button>
          <span className="text-[11px]" style={{ color: "var(--ink-4, var(--ink-3))" }}>
            {hint ?? "PNG, JPG or WEBP · square works best"}
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pick(f);
            e.target.value = "";
          }}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
});
