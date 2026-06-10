"use client";

import Link from "next/link";
import { useState } from "react";

import { cn } from "@/lib/cn";

const APP_LOGO_SRC = "/logo.png";

type AppLogoProps = {
  href?: string;
  label?: string;
  showWordmark?: boolean;
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
};

function LogoMark({ className }: { className?: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={cn(
        "relative inline-flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--bg)]",
        className,
      )}
      aria-hidden
    >
      {!failed ? (
        <img
          src={APP_LOGO_SRC}
          alt=""
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="absolute inset-[20%] rounded-full bg-[var(--accent)]" />
      )}
    </span>
  );
}

export function AppLogo({
  href = "/",
  label = "Go to home",
  showWordmark = true,
  className,
  markClassName,
  wordmarkClassName,
}: AppLogoProps) {
  const content = (
    <>
      <LogoMark className={markClassName} />
      {showWordmark && (
        <span
          className={cn(
            "text-[17px] font-semibold text-[var(--ink)]",
            wordmarkClassName,
          )}
        >
          Udo
        </span>
      )}
    </>
  );

  if (!href) {
    return (
      <span className={cn("inline-flex items-center gap-2.5", className)}>
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-md transition-opacity hover:opacity-80",
        className,
      )}
    >
      {content}
    </Link>
  );
}
