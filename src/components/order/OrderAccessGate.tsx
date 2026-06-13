"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

import { Loading } from "@/components/ui/States";
import { migrateCartStorage, useCart } from "@/contexts/CartContext";
import { api } from "@/lib/fetcher";
import { getSocket } from "@/lib/socket-client";
import type { SessionCancelledPayload, TableMovedPayload } from "@/types";

type AccessResponse =
  | { valid: true; session: { id: string }; tableId: string }
  | { valid: false; reason: "not_found" | "expired" }
  | { valid: false; reason: "moved"; tableNumber: string };

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
  const pathname = usePathname();
  const router = useRouter();
  const cart = useCart();
  const [state, setState] = useState<
    | { kind: "checking" }
    | { kind: "ok"; tableId: string }
    | { kind: "denied"; reason: "not_found" | "expired" }
  >({ kind: "checking" });

  // Staff moved this session to another table — carry the cart over and swap
  // the table segment of the current URL, keeping the sub-page and `?s=`.
  const followMove = useCallback(
    (toTableNumber: string) => {
      migrateCartStorage(branchId, tableNo, toTableNumber);
      const segments = pathname.split("/"); // ["", "order", branchId, tableNo, ...rest]
      segments[3] = encodeURIComponent(toTableNumber);
      const sessionId = params.get("s");
      router.replace(
        `${segments.join("/")}${sessionId ? `?s=${sessionId}` : ""}`,
      );
    },
    [branchId, tableNo, pathname, params, router],
  );

  useEffect(() => {
    // Access is granted solely by the `?s=<sessionId>` query param; internal
    // links propagate it so navigation between menu/cart/status/bill keeps it.
    const sessionId = params.get("s");

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
          setState({ kind: "ok", tableId: res.tableId });
        } else if (res.reason === "moved") {
          // Stay on the loading screen while the redirect re-runs the gate.
          followMove(res.tableNumber);
        } else {
          // The session was closed/paid out — drop any stale cart so the next
          // guest at this table starts fresh.
          if (res.reason === "expired") cart.clear();
          setState({ kind: "denied", reason: res.reason });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "denied", reason: "not_found" });
      });

    return () => {
      cancelled = true;
    };
  }, [branchId, tableNo, params, cart.clear, followMove]);

  // Live follow: staff moving the table mid-session pushes every customer
  // device on the old table's room to the new table URL.
  useEffect(() => {
    if (state.kind !== "ok") return;
    const sessionId = params.get("s");
    const { tableId } = state;
    const socket = getSocket();

    const join = () => socket.emit("table:join", { tableId });
    const onMoved = (p: TableMovedPayload) => {
      if (p.sessionId !== sessionId) return;
      followMove(p.toTableNumber);
    };
    // Staff cancelled the table — the session is gone, so drop the cart and
    // show the expired screen immediately.
    const onCancelled = (p: SessionCancelledPayload) => {
      if (p.sessionId !== sessionId) return;
      cart.clear();
      setState({ kind: "denied", reason: "expired" });
    };

    if (socket.connected) join();
    socket.on("connect", join);
    socket.on("table:moved", onMoved);
    socket.on("session:cancelled", onCancelled);
    return () => {
      socket.off("connect", join);
      socket.off("table:moved", onMoved);
      socket.off("session:cancelled", onCancelled);
    };
  }, [state, params, followMove, cart.clear]);

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
