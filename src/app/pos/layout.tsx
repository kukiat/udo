import { requireAccess } from "@/lib/guard";

export default async function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAccess("pos");
  return children;
}
