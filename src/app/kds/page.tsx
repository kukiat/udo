"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AccountMenu } from "@/components/ui/AccountMenu";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, TD, TH, THead, TR } from "@/components/ui/Table";
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

const PAGE_SIZE = 10;

// Entry point for KDS: list the restaurant's branches together with each
// branch's tables, and let the user pick one to open its kitchen display.
export default function KdsIndex() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [branches, setBranches] = useState<BranchWithTables[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login?next=/kds");
      return;
    }
    setBranches(null);
    const offset = (page - 1) * PAGE_SIZE;
    api<{ branches: Branch[]; total: number }>(
      `/api/branches?withRestaurant=true&limit=${PAGE_SIZE}&offset=${offset}`,
    )
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
        setTotal(d.total);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load branches"),
      );
  }, [user, loading, router, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageBranches = branches ?? [];

  return (
    <div className="min-h-screen bg-cream">
      <header className="flex items-center justify-between border-b border-line bg-white px-5 py-4">
        <div>
          <h1 className="text-xl font-bold text-ink">Kitchen Display</h1>
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
            <Table>
              <THead>
                <TR>
                  <TH>Restaurant</TH>
                  <TH>Branch</TH>
                  <TH>Tables</TH>
                  <TH className="text-right">Occupied</TH>
                </TR>
              </THead>
              <tbody>
                {pageBranches.map((b) => {
                  const occupied = b.tables.filter(
                    (t) => t.status === "occupied",
                  ).length;
                  return (
                    <TR
                      key={b.id}
                      className="cursor-pointer transition-colors hover:bg-sand"
                      onClick={() => router.push(`/kds/${b.id}`)}
                    >
                      <TD className="text-ink-muted">
                        {b.restaurant?.name ?? "—"}
                      </TD>
                      <TD>
                        <span className="font-semibold text-ink">{b.name}</span>
                        {b.address && (
                          <span className="block text-xs text-ink-muted">
                            {b.address}
                          </span>
                        )}
                      </TD>
                      <TD>
                        <Badge tone="neutral">{b.tables.length}</Badge>
                      </TD>
                      <TD className="text-right">
                        <Badge tone={occupied ? "amber" : "neutral"}>
                          {occupied}
                        </Badge>
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </Table>

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
