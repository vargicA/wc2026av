import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MatchRow, type MatchRowData } from "@/components/MatchRow";
import { useAuth } from "@/hooks/use-auth";
import { fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/fixtures")({
  component: FixturesPage,
});

type Filter = "all" | "upcoming" | "live" | "finished";

function FixturesPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");

  const { data: matches, isLoading } = useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches").select("*").order("kickoff_utc", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MatchRowData[];
    },
  });

  const { data: myPreds } = useQuery({
    queryKey: ["my-preds", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("predictions")
        .select("match_id, predicted_score_home, predicted_score_away, points_awarded")
        .eq("user_id", user!.id);
      if (error) throw error;
      const map = new Map<number, { h: number; a: number; pts: number | null }>();
      for (const p of data ?? []) {
        map.set(p.match_id as number, { h: p.predicted_score_home, a: p.predicted_score_away, pts: p.points_awarded });
      }
      return map;
    },
  });

  const { data: myChips } = useQuery({
    queryKey: ["my-chips", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("match_chips").select("match_id, chip_type").eq("user_id", user!.id);
      const m = new Map<number, string>();
      for (const c of data ?? []) m.set(c.match_id as number, c.chip_type as string);
      return m;
    },
  });

  const { data: banker } = useQuery({
    queryKey: ["banker", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_bankers").select("team_code").eq("user_id", user!.id).maybeSingle();
      return data?.team_code ?? null;
    },
  });

  const filtered = useMemo(() => {
    if (!matches) return [];
    return matches.filter((m) => {
      if (filter === "upcoming") return m.status === "scheduled";
      if (filter === "live") return m.status === "live";
      if (filter === "finished") return m.status === "finished";
      return true;
    });
  }, [matches, filter]);

  const grouped = useMemo(() => {
    const g = new Map<string, MatchRowData[]>();
    for (const m of filtered) {
      const day = new Date(m.kickoff_utc).toDateString();
      const arr = g.get(day) ?? [];
      arr.push(m);
      g.set(day, arr);
    }
    return Array.from(g.entries());
  }, [filtered]);

  return (
    <main className="container-app py-6">
      <div className="flex items-baseline justify-between">
        <h1 className="display text-3xl font-semibold">Fixtures</h1>
        <span className="text-sm text-muted-foreground tabular">{matches?.length ?? 0} matches</span>
      </div>

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-2">
        {(["all", "upcoming", "live", "finished"] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`pill ${filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"}`}>
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="mt-8 text-muted-foreground">Loading…</p>
      ) : grouped.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
          No matches match this filter.
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          {grouped.map(([day, ms]) => (
            <section key={day}>
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">{fmtDate(ms[0].kickoff_utc)}</h3>
              <div className="space-y-2">
                {ms.map((m) => {
                  const p = myPreds?.get(m.id);
                  const chip = (myChips?.get(m.id) ?? null) as any;
                  const bankerHit = !!banker && (banker === m.team_home_code || banker === m.team_away_code);
                  return <MatchRow key={m.id} m={m} predicted={p ? { h: p.h, a: p.a } : undefined} points={p?.pts ?? null} chip={chip} bankerHit={bankerHit} />;
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
