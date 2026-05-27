"use client";

import Link from "next/link";

import { cn } from "@/lib/cn";

// Home icon link shown at the top-left of app top bars (links to landing).
export function HomeLink({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Home"
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-xl text-ink-soft hover:bg-sand hover:text-ink",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden
      >
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </svg>
    </Link>
  );
}
