"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/fetcher";
import type { AuthUser } from "@/lib/auth";

// Where to send each role after login when no explicit ?next is provided.
function landingFor(user: AuthUser): string {
  switch (user.role) {
    case "cashier":
      return user.branchId ? `/pos/${user.branchId}` : "/dashboard";
    case "kitchen_staff":
      return user.branchId ? `/kds/${user.branchId}` : "/dashboard";
    case "waitstaff":
      return "/waitstaff";
    default:
      return "/dashboard";
  }
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { user } = await api<{ user: AuthUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setUser(user);
      const next = params.get("next");
      router.push(next || landingFor(user));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream p-4">
      <div className="w-full max-w-sm rounded-card border border-line bg-white p-6 shadow-card">
        <h1 className="text-xl font-bold text-ink">Sign in</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Restaurant management system
        </p>
        <form
          className="mt-5 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoFocus
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            type="submit"
            isDisabled={submitting || !email || !password}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
