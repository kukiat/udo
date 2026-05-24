import { requireAccess } from "@/lib/guard";

export default async function WaitstaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAccess("waitstaff");
  return children;
}
