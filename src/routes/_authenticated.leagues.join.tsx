import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { joinLeague } from "@/lib/app.functions";

export const Route = createFileRoute("/_authenticated/leagues/join")({
  component: JoinLeague,
});

function JoinLeague() {
  const navigate = useNavigate();
  const join = useServerFn(joinLeague);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setLoading(true);
    try {
      const res = await join({ data: { invite_code: code } });
      navigate({ to: "/leagues/$leagueId", params: { leagueId: res.league.id } });
    } catch (e: any) { setErr(e.message ?? "Failed"); setLoading(false); }
  }

  return (
    <main className="container-app max-w-sm pt-10">
      <h1 className="display text-3xl font-semibold">Join a league</h1>
      <p className="mt-1 text-sm text-muted-foreground">Enter the 6-character invite code from a friend.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <input required maxLength={12} placeholder="INVITE CODE" value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          className="w-full rounded-md border border-input bg-background px-3 py-2.5 tabular tracking-widest text-center text-lg" />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button disabled={loading} className="w-full rounded-md bg-primary py-2.5 text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50">
          {loading ? "Joining…" : "Join league"}
        </button>
      </form>
    </main>
  );
}
