import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createLeague } from "@/lib/app.functions";

export const Route = createFileRoute("/_authenticated/leagues/new")({
  component: NewLeague,
});

function NewLeague() {
  const navigate = useNavigate();
  const create = useServerFn(createLeague);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setLoading(true);
    try {
      const res = await create({ data: { name } });
      navigate({ to: "/leagues/$leagueId", params: { leagueId: res.league.id } });
    } catch (e: any) { setErr(e.message ?? "Failed"); setLoading(false); }
  }

  return (
    <main className="container-app max-w-sm pt-10">
      <h1 className="display text-3xl font-semibold">New league</h1>
      <p className="mt-1 text-sm text-muted-foreground">Pick a name. You'll get an invite code to share.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <input required maxLength={60} placeholder="e.g. The Office Cup" value={name} onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2.5" />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <button disabled={loading} className="w-full rounded-md bg-primary py-2.5 text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50">
          {loading ? "Creating…" : "Create league"}
        </button>
      </form>
    </main>
  );
}
