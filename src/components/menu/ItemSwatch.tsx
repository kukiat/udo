"use client";

// Editorial "photo" placeholder: a warm color swatch with a soft radial
// highlight and the item's initials, matching the Self-Order design. Falls
// back to the real image when one is set.

const PALETTE = [
  "#9e3b2e", // deep red
  "#b9543d", // terracotta
  "#c98a3c", // amber
  "#7c8a4e", // olive
  "#5f8a8b", // teal
  "#8aa6c4", // dusty blue
  "#a98bb0", // mauve
  "#c2a96b", // gold
  "#b07b6b", // clay
  "#6b8f71", // sage
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function ItemSwatch({
  name,
  id,
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
  const color = PALETTE[hash(id || name) % PALETTE.length];
  const big = size === "lg";
  const dims =
    size === "lg"
      ? "h-full w-full"
      : size === "xs"
        ? "h-11 w-11"
        : "h-[76px] w-[76px]";

  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name}
        className={`${dims} flex-shrink-0 object-cover ${className}`}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={`relative ${dims} flex-shrink-0 overflow-hidden ${className}`}
      style={{ background: color }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 60% at 36% 32%, rgba(255,255,255,0.32), rgba(255,255,255,0) 70%)",
        }}
      />
      <div
        className={`absolute inset-0 grid place-items-center italic text-white/80 ${
          big ? "text-[64px]" : "text-[28px]"
        }`}
        style={{ textShadow: "0 1px 0 rgba(0,0,0,0.18)" }}
      >
        {initials(name)}
      </div>
    </div>
  );
}
