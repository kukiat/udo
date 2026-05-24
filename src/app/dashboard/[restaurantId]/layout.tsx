import { Sidebar } from "@/components/dashboard/Sidebar";
import { RestaurantProvider } from "@/contexts/RestaurantContext";

export default async function RestaurantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  return (
    <RestaurantProvider restaurantId={restaurantId}>
      <div className="flex min-h-screen flex-col bg-cream md:flex-row">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-5 md:p-8">{children}</main>
      </div>
    </RestaurantProvider>
  );
}
