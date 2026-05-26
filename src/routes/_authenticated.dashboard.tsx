import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { MatchRow, type MatchRowData } from "@/components/MatchRow";
import { fmtKickoff, countdownTo } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();

  const { data: leagues } = useQuery({
    queryKey: ["my-leagues", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("league_members")
        .select("league_id, leagues(id, name, invite_code)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data?.map((r: any) => r.leagues).filter(Boolean) ?? [];
    },
  });

  const { data: nextMatch } = useQuery({
    queryKey: ["next-match"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .gte("kickoff_utc", new Date().toISOString())
        .order("kickoff_utc", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as MatchRowData | null;
    },
  });

  return (
    <main className="container-app py-6 space-y-8">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="display text-2xl font-semibold">Up next</h2>
          <Link to="/fixtures" className="text-sm text-muted-foreground hover:text-foreground">All fixtures →</Link>
        </div>
        {nextMatch ? (
          <>
            <div className="text-xs text-muted-foreground mb-1 tabular">
              {fmtKickoff(nextMatch.kickoff_utc)} · locks in {countdownTo(nextMatch.prediction_lock_utc).text}
            </div>
            <MatchRow m={nextMatch} />
          </>
        ) : (
          <div className="rounded-lg border border-border bg-card p-6 text-muted-foreground text-sm">
            Fixtures will appear once they sync. Check back shortly.
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="display text-2xl font-semibold">Your leagues</h2>
          <div className="flex gap-2">
            <Link to="/leagues/join" className="text-sm rounded-md border border-input px-3 py-1.5 hover:bg-accent">Join</Link>
            <Link to="/leagues/new" className="text-sm rounded-md bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90">New</Link>
          </div>
        </div>
        {!leagues || leagues.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
            You're not in any leagues yet. <Link to="/leagues/new" className="text-primary hover:underline">Create one</Link> or <Link to="/leagues/join" className="text-primary hover:underline">join with a code</Link>.
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {leagues.map((l: any) => (
              <Link key={l.id} to="/leagues/$leagueId" params={{ leagueId: l.id }}
                className="rounded-lg border border-border bg-card p-4 hover:border-primary/50">
                <div className="font-medium">{l.name}</div>
                <div className="text-xs text-muted-foreground mt-1 tabular">Code: {l.invite_code}</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
