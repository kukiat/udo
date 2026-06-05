import { DashboardShell } from "@/components/dashboard/DashboardShell";
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
      <DashboardShell restaurantId={restaurantId}>{children}</DashboardShell>
    </RestaurantProvider>
  );
}
