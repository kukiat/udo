import { requireAccess } from "@/lib/guard";

export default async function KdsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAccess("kds");
  return children;
}
