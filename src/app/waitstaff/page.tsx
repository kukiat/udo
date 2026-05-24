"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AccountMenu } from "@/components/ui/AccountMenu";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/fetcher";

type Branch = {
  id: string;
  name: string;
  address: string | null;
  restaurant?: { id: string; name: string } | null;
};
type TableRow = {
  id: string;
  tableNumber: string;
  status: "available" | "occupied";
};
type BranchWithTables = Branch & { tables: TableRow[] };

const PAGE_SIZE = 5;

// Entry point for waitstaff: list the restaurant's branches together with each
// branch's tables, and let the user pick one to view its orders detail.
export default function WaitstaffIndex() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [branches, setBranches] = useState<BranchWithTables[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login?next=/waitstaff");
      return;
    }
    api<{ branches: Branch[] }>(`/api/branches?withRestaurant=true`)
      .then(async (d) => {
        const withTables = await Promise.all(
          d.branches.map(async (b) => {
            const { tables } = await api<{ tables: TableRow[] }>(
              `/api/tables?branchId=${b.id}`,
            );
            return { ...b, tables };
          }),
        );
        setBranches(withTables);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load branches"),
      );
  }, [user, loading, router]);

  const totalPages = branches ? Math.max(1, Math.ceil(branches.length / PAGE_SIZE)) : 1;
  const pageBranches = useMemo(
    () => (branches ? branches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : []),
    [branches, page],
  );

  return (
    <div className="min-h-screen bg-cream">
      <header className="flex items-center justify-between border-b border-line bg-white px-5 py-4">
        <div>
          <h1 className="text-xl font-bold text-ink">Waitstaff</h1>
          <p className="mt-0.5 text-sm text-ink-muted">Choose a branch</p>
        </div>
        <AccountMenu />
      </header>

      <main className="mx-auto max-w-3xl p-5">
        {error ? (
          <ErrorState message={error} />
        ) : !branches ? (
          <Loading label="Loading branches…" />
        ) : branches.length === 0 ? (
          <EmptyState
            title="No branches"
            description="This restaurant has no branches yet."
          />
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {pageBranches.map((b) => (
                <Link
                  key={b.id}
                  href={`/waitstaff/${b.id}`}
                  className="block rounded-card border border-line bg-white p-5 shadow-card transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {b.restaurant && (
                        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                          {b.restaurant.name}
                        </p>
                      )}
                      <p className="font-semibold text-ink">{b.name}</p>
                      {b.address && (
                        <p className="mt-1 text-sm text-ink-muted">{b.address}</p>
                      )}
                    </div>
                    <Badge tone="neutral">{b.tables.length} tables</Badge>
                  </div>

                  {b.tables.length === 0 ? (
                    <p className="mt-3 text-sm text-ink-muted">No tables yet.</p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {b.tables.map((t) => (
                        <span
                          key={t.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-sand px-2 py-1 text-xs text-ink-soft"
                        >
                          <span className="font-medium">Table {t.tableNumber}</span>
                          <Badge
                            tone={t.status === "occupied" ? "amber" : "neutral"}
                          >
                            {t.status}
                          </Badge>
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-5 flex items-center justify-between">
                <Button
                  variant="secondary"
                  size="sm"
                  isDisabled={page <= 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-sm text-ink-muted">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  isDisabled={page >= totalPages}
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
