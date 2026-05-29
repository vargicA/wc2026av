import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", replace: true });
      return;
    }
    let pending: string | null = null;
    try { pending = localStorage.getItem("pending_invite"); } catch {}
    if (pending) {
      try { localStorage.removeItem("pending_invite"); } catch {}
      navigate({ to: "/invite/$code", params: { code: pending }, replace: true });
    }
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <>
        <AppHeader />
        <main className="container-app pt-16 text-center text-muted-foreground">Loading…</main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  );
}
