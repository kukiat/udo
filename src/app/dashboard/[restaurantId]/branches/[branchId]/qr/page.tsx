"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon, PrinterIcon } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { PillButton } from "@/components/ui/PillButton";
import { EmptyState, ErrorState, Loading } from "@/components/ui/States";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { api } from "@/lib/fetcher";

type TableRow = {
  id: string;
  branchId: string;
  tableNumber: string;
  status: "available" | "occupied";
};

type TablesResponse = { tables: TableRow[] };

export default function BranchQrPrintPage() {
  const params = useParams<{ restaurantId: string; branchId: string }>();
  const { restaurantId, restaurantName, branches, loading: restaurantLoading } =
    useRestaurant();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const branch = useMemo(
    () => branches.find((b) => b.id === params.branchId) ?? null,
    [branches, params.branchId],
  );

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api<TablesResponse>(`/api/tables?branchId=${params.branchId}`)
      .then(({ tables }) => {
        if (active) setTables(tables);
      })
      .catch((e) => {
        if (active) {
          setError(e instanceof Error ? e.message : "Failed to load tables");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [params.branchId]);

  const orderUrl = (tableNumber: string) =>
    `${origin}/order/${params.branchId}/${encodeURIComponent(tableNumber)}`;

  if (restaurantLoading || loading) return <Loading />;

  return (
    <div className="qr-print-page max-w-6xl">
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }

          body {
            background: #fff !important;
          }

          body * {
            visibility: hidden;
          }

          .qr-print-page,
          .qr-print-page * {
            visibility: visible;
          }

          .qr-print-page {
            position: absolute;
            inset: 0 auto auto 0;
            width: 100% !important;
            padding: 0 !important;
            color: #111 !important;
          }

          .qr-no-print,
          .qr-no-print * {
            display: none !important;
            visibility: hidden !important;
          }

          .qr-print-title {
            display: block !important;
          }

          .qr-print-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 12mm !important;
          }

          .qr-print-card {
            break-inside: avoid;
            page-break-inside: avoid;
            border-color: #222 !important;
            background: #fff !important;
            box-shadow: none !important;
          }

          .qr-print-card,
          .qr-print-card * {
            color: #111 !important;
          }
        }
      `}</style>

      <div
        className="qr-no-print row"
        style={{ justifyContent: "space-between", marginBottom: 24 }}
      >
        <div>
          <Link
            href={`/dashboard/${restaurantId}/branches`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
              color: "var(--text-2)",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Branches
          </Link>
          <div className="h-display" style={{ fontSize: 44 }}>
            Table QR codes
          </div>
          <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>
            {branch?.name ?? "Branch"} - {tables.length}{" "}
            {tables.length === 1 ? "table" : "tables"}
          </div>
        </div>
        <PillButton
          tone="accent"
          onClick={() => window.print()}
          isDisabled={tables.length === 0 || !origin}
        >
          <PrinterIcon className="h-4 w-4" />
          Print
        </PillButton>
      </div>

      {error ? (
        <ErrorState message={error} />
      ) : tables.length === 0 ? (
        <EmptyState
          title="No tables yet"
          description="Add tables to this branch before printing QR codes."
        />
      ) : (
        <>
          <div
            className="qr-print-title"
            style={{
              display: "none",
              marginBottom: 18,
              fontSize: 18,
              fontWeight: 800,
            }}
          >
            {restaurantName ?? "Restaurant"} - {branch?.name ?? "Branch"}
          </div>
          <div
            className="qr-print-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
              gap: 16,
            }}
          >
            {tables.map((table) => {
              const url = orderUrl(table.tableNumber);
              return (
                <section
                  key={table.id}
                  className="qr-print-card"
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    background: "var(--bg-elev)",
                    padding: 18,
                    display: "grid",
                    justifyItems: "center",
                    textAlign: "center",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--ink-3)",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                    }}
                  >
                    {restaurantName ?? "Restaurant"}
                  </div>
                  <div
                    style={{
                      fontSize: 30,
                      fontWeight: 800,
                      color: "var(--ink)",
                    }}
                  >
                    Table {table.tableNumber}
                  </div>
                  <div
                    style={{
                      padding: 10,
                      background: "#fff",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    <QRCodeSVG
                      value={url}
                      size={172}
                      marginSize={2}
                      level="M"
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: "var(--ink)",
                    }}
                  >
                    Scan to order
                  </div>
                  <div
                    className="mono"
                    style={{
                      maxWidth: "100%",
                      overflowWrap: "anywhere",
                      fontSize: 10,
                      color: "var(--ink-3)",
                    }}
                  >
                    {url}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
