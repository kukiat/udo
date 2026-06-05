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
      <div className="mx-auto min-h-screen max-w-2xl bg-cream pb-28 lg:max-w-none">
        <OrderAccessGate branchId={branchId} tableNo={tableNo}>
          {children}
        </OrderAccessGate>
      </div>
    </CartProvider>
  );
}
