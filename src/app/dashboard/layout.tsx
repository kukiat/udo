import { requireAccess } from "@/lib/guard";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAccess("dashboard", "/dashboard");
  return <div className="dir-a min-h-screen">{children}</div>;
}
