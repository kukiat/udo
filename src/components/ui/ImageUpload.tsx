"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/Button";
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
  }
>(function ImageUpload({ label, value, onChange, className, deferred }, ref) {
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
  const hasPending = preview !== null;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <span className="label">{label}</span>}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          title="Click to upload image"
          aria-label="Upload image"
          className="flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-line bg-sand transition-colors hover:border-clay-300 disabled:cursor-wait"
        >
          {uploading ? (
            <span className="text-xs text-ink-muted">Uploading…</span>
          ) : shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="px-1 text-center text-xs text-ink-muted">
              Click to upload
            </span>
          )}
        </button>
        <div className="flex flex-1 flex-col gap-2">
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
          {shown && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onPress={() => {
                  clearPending();
                  onChange(null);
                }}
              >
                Remove
              </Button>
            </div>
          )}
          {hasPending ? (
            <p className="text-xs text-ink-muted">
              Image ready — uploads when you save.
            </p>
          ) : (
            <input
              type="url"
              value={value ?? ""}
              placeholder="…or paste an image URL"
              onChange={(e) => onChange(e.target.value || null)}
              className="input"
            />
          )}
          {!hasPending && value && (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="self-start text-xs text-clay-600 hover:text-clay-700 hover:underline"
            >
              Open link ↗
            </a>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
});
