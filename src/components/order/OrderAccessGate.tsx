"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Loading } from "@/components/ui/States";
import { api } from "@/lib/fetcher";

type AccessResponse =
  | { valid: true; session: { id: string }; tableId: string }
  | { valid: false; reason: "not_found" | "expired" };

function storageKey(branchId: string, tableNo: string) {
  return `rms.order.session.${branchId}:${tableNo}`;
}

function GateInner({
  branchId,
  tableNo,
  children,
}: {
  branchId: string;
  tableNo: string;
  children: React.ReactNode;
}) {
  const params = useSearchParams();
  const [state, setState] = useState<
    | { kind: "checking" }
    | { kind: "ok" }
    | { kind: "denied"; reason: "not_found" | "expired" }
  >({ kind: "checking" });

  useEffect(() => {
    const key = storageKey(branchId, tableNo);
    // The link carries `?s=<sessionId>`; once validated we remember it for the
    // tab so navigating between menu/cart/status/bill keeps access.
    const fromUrl = params.get("s");
    const sessionId =
      fromUrl ?? sessionStorage.getItem(key) ?? null;

    if (!sessionId) {
      setState({ kind: "denied", reason: "not_found" });
      return;
    }

    let cancelled = false;
    setState({ kind: "checking" });
    api<AccessResponse>(
      `/api/sessions/access?branchId=${branchId}&tableNo=${encodeURIComponent(
        tableNo,
      )}&sessionId=${sessionId}`,
    )
      .then((res) => {
        if (cancelled) return;
        if (res.valid) {
          sessionStorage.setItem(key, sessionId);
          setState({ kind: "ok" });
        } else {
          sessionStorage.removeItem(key);
          setState({ kind: "denied", reason: res.reason });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "denied", reason: "not_found" });
      });

    return () => {
      cancelled = true;
    };
  }, [branchId, tableNo, params]);

  if (state.kind === "checking") {
    return <Loading label="Checking your table…" />;
  }

  if (state.kind === "denied") {
    return <AccessDenied reason={state.reason} />;
  }

  return <>{children}</>;
}

function AccessDenied({ reason }: { reason: "not_found" | "expired" }) {
  const expired = reason === "expired";
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="rounded-card border border-line bg-white p-8 shadow-card">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sand text-2xl">
          {expired ? "⏱️" : "🔒"}
        </div>
        <h1 className="text-xl font-semibold text-ink">
          {expired ? "This link has expired" : "Link not available"}
        </h1>
        <p className="mt-2 max-w-sm text-sm text-ink-muted">
          {expired
            ? "Your table session has been closed. Please ask a staff member to open a new session for your table."
            : "This ordering link is invalid or no session is open for this table. Please ask a staff member to open a session and share the link."}
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-clay-600 hover:text-clay-800"
        >
          Back to start
        </Link>
      </div>
    </div>
  );
}

export function OrderAccessGate({
  branchId,
  tableNo,
  children,
}: {
  branchId: string;
  tableNo: string;
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<Loading label="Checking your table…" />}>
      <GateInner branchId={branchId} tableNo={tableNo}>
        {children}
      </GateInner>
    </Suspense>
  );
}
