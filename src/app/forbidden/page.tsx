import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream p-4 text-center">
      <h1 className="text-2xl font-bold text-ink">Access denied</h1>
      <p className="max-w-sm text-sm text-ink-muted">
        Your account role doesn&apos;t have permission to view this area.
      </p>
      <Link
        href="/dashboard"
        className="rounded-xl bg-clay-500 px-4 py-2 text-sm font-medium text-white hover:bg-clay-600"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
