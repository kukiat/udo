import { OrderAccessGate } from "@/components/order/OrderAccessGate";
import { CartProvider } from "@/contexts/CartContext";

export default async function OrderLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ branchId: string; tableNo: string }>;
}) {
  const { branchId, tableNo } = await params;
  return (
    <CartProvider branchId={branchId} tableNo={tableNo}>
      <div className="order-theme min-h-screen bg-[var(--bg)] text-[var(--ink)]">
        <OrderAccessGate branchId={branchId} tableNo={tableNo}>
          <div className="mx-auto min-h-screen max-w-2xl pb-28 lg:max-w-none">
            {children}
          </div>
        </OrderAccessGate>
      </div>
    </CartProvider>
  );
}
