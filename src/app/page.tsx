"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Loading } from "@/components/ui/States";
import { api } from "@/lib/fetcher";

type Bootstrap = {
  restaurant: { name: string };
  branch: { id: string; name: string };
};

export default function Home() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Bootstrap>("/api/bootstrap")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-ink">RMS</h1>
        <p className="mt-1 text-ink-muted">
          Self-Order, KDS &amp; Menu Management
        </p>
      </div>

      {error ? (
        <p className="text-center text-sm text-red-600">
          {error} — have you run the seed (`npm run db:seed`)?
        </p>
      ) : !data ? (
        <Loading label="Loading demo data…" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card
            href="/waitstaff"
            title="Waitstaff"
            desc="Pick a branch, open a table session for the order link"
          />
          <Card
            href={`/kds/${data.branch.id}`}
            title="Kitchen Display"
            desc="Live order board"
          />
          <Card href="/dashboard" title="Dashboard" desc="Manage the menu" />
        </div>
      )}
    </main>
  );
}

function Card({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-card border border-line bg-white p-5 text-center shadow-card transition-shadow hover:shadow-md"
    >
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-1 text-xs text-ink-muted">{desc}</p>
    </Link>
  );
}
