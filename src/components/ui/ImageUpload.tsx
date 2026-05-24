"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

// Image picker that uploads a file to /api/uploads and reports the resulting
// URL, with a manual URL field as a fallback. Value is the stored URL/path.
export function ImageUpload({
  label,
  value,
  onChange,
  className,
}: {
  label?: string;
  value: string | null;
  onChange: (url: string | null) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Upload failed");
      onChange(json.url as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <span className="text-sm font-medium text-ink-soft">{label}</span>
      )}
      <div className="flex items-start gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-sand">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-ink-muted">No image</span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              isDisabled={uploading}
              onPress={() => inputRef.current?.click()}
            >
              {uploading ? "Uploading…" : "Upload image"}
            </Button>
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onPress={() => onChange(null)}
              >
                Remove
              </Button>
            )}
          </div>
          <input
            type="url"
            value={value ?? ""}
            placeholder="…or paste an image URL"
            onChange={(e) => onChange(e.target.value || null)}
            className="w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-clay-300 focus:ring-2 focus:ring-clay-100"
          />
          {value && (
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
}
