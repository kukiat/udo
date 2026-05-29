import { Sidebar } from "@/components/dashboard/Sidebar";
import { RestaurantTopBar } from "@/components/dashboard/TopBar";
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
      <div className="flex min-h-screen flex-col">
        <RestaurantTopBar />
        <div className="flex flex-1 flex-col md:flex-row">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-5 md:p-7">{children}</main>
        </div>
      </div>
    </RestaurantProvider>
  );
}
