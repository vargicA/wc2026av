import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { joinLeague } from "@/lib/app.functions";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/invite/$code")({
  component: InvitePage,
});

function InvitePage() {
  const { code } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const join = useServerFn(joinLeague);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/signup", search: { invite: code } as any, replace: true });
      return;
    }
    join({ data: { invite_code: code } })
      .then((res) => navigate({ to: "/leagues/$leagueId", params: { leagueId: res.league.id }, replace: true }))
      .catch((e) => setErr(e.message ?? "Could not join"));
  }, [loading, user, code, join, navigate]);

  return (
    <>
      <AppHeader />
      <main className="container-app pt-12 text-center text-muted-foreground">
        {err ? <p className="text-destructive">{err}</p> : <p>Joining league…</p>}
      </main>
    </>
  );
}
