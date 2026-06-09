"use client";

import { useEffect, useState } from "react";

export function ItemSwatch({
  name,
  image,
  size = "sm",
  className = "",
}: {
  name: string;
  id: string;
  image?: string | null;
  size?: "xs" | "sm" | "lg";
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const dims =
    size === "lg"
      ? "h-full w-full"
      : size === "xs"
        ? "h-11 w-11"
        : "h-[76px] w-[76px]";
  const imageUrl = image?.trim();

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  if (imageUrl && !imageFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        className={`${dims} flex-shrink-0 object-cover ${className}`}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={`relative ${dims} flex-shrink-0 overflow-hidden bg-black ${className}`}
    />
  );
}
