import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { updateDisplayName } from "@/lib/app.functions";
import { CHIP_META, type ChipType } from "@/lib/chips";


export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const update = useServerFn(updateDisplayName);
  const [name, setName] = useState("");
  const [edit, setEdit] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("predictions")
        .select("match_id, predicted_score_home, predicted_score_away, points_awarded, matches(team_home, team_away, kickoff_utc, score_home_ft, score_away_ft, status)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const totalPoints = (history ?? []).reduce((s, h: any) => s + (h.points_awarded ?? 0), 0);

  const { data: chips } = useQuery({
    queryKey: ["my-chips-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("match_chips")
        .select("match_id, chip_type")
        .eq("user_id", user!.id);
      const m = new Map<number, ChipType>();
      for (const c of data ?? []) m.set(c.match_id as number, c.chip_type as ChipType);
      return m;
    },
  });

  const stats = useMemo(() => {
    const scored = (history ?? [])
      .filter((h: any) => h.matches?.status === "finished" && h.points_awarded !== null)
      .sort((a: any, b: any) => new Date(a.matches.kickoff_utc).getTime() - new Date(b.matches.kickoff_utc).getTime());

    const total = scored.length;
    if (total === 0) return null;

    const exact = scored.filter((h: any) => Number(h.points_awarded) === 3).length;
    const correct = scored.filter((h: any) => Number(h.points_awarded) >= 1).length;

    let longestStreak = 0;
    let current = 0;
    for (const h of scored) {
      if (Number(h.points_awarded) >= 1) {
        current += 1;
        longestStreak = Math.max(longestStreak, current);
      } else {
        current = 0;
      }
    }

    return {
      exactPct: Math.round((exact / total) * 100),
      correctPct: Math.round((correct / total) * 100),
      longestStreak,
    };
  }, [history]);

  const mut = useMutation({
    mutationFn: async () => update({ data: { display_name: name } }),
    onSuccess: () => { setEdit(false); qc.invalidateQueries({ queryKey: ["profile"] }); },
  });

  return (
    <main className="container-app py-6 space-y-8">
      <section>
        <h1 className="display text-3xl font-semibold">Profile</h1>
        <div className="mt-4 rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Display name</div>
              {edit ? (
                <div className="mt-1 flex gap-2">
                  <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1" />
                  <button onClick={() => mut.mutate()} disabled={mut.isPending} className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground">Save</button>
                  <button onClick={() => setEdit(false)} className="text-sm text-muted-foreground">Cancel</button>
                </div>
              ) : (
                <div className="text-lg font-medium">{profile?.display_name ?? "—"}</div>
              )}
            </div>
            {!edit && (
              <button onClick={() => { setName(profile?.display_name ?? ""); setEdit(true); }}
                className="text-sm text-muted-foreground hover:text-foreground">Edit</button>
            )}
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Email</div>
            <div className="text-sm">{user?.email}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Total points</div>
            <div className="score-num text-3xl">{totalPoints}</div>
          </div>
          {stats && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border border-border bg-muted/40 p-3 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Exact</div>
                <div className="score-num text-xl">{stats.exactPct}%</div>
              </div>
              <div className="rounded-md border border-border bg-muted/40 p-3 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Correct</div>
                <div className="score-num text-xl">{stats.correctPct}%</div>
              </div>
              <div className="rounded-md border border-border bg-muted/40 p-3 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Streak</div>
                <div className="score-num text-xl">{stats.longestStreak}</div>
              </div>
            </div>
          )}
          <div className="pt-2 border-t border-border">
            <button
              onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}
              className="text-sm text-muted-foreground hover:text-destructive"
            >
              Sign out
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="display text-xl font-semibold mb-3">Prediction history</h2>
        {(!history || history.length === 0) ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
            No predictions yet. <Link to="/fixtures" className="text-primary hover:underline">Make some.</Link>
          </div>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border">
            {history.map((h: any) => {
              const chip = chips?.get(h.match_id) ?? null;
              return (
                <Link key={h.match_id} to="/matches/$matchId" params={{ matchId: String(h.match_id) }}
                  className="block p-3 hover:bg-accent/30">
                  <div className="flex items-center justify-between text-sm gap-3">
                    <span className="truncate">{h.matches?.team_home} vs {h.matches?.team_away}</span>
                    <span className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                      <span className="inline-flex items-baseline gap-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Pick</span>
                        <span className="tabular font-medium">{h.predicted_score_home}–{h.predicted_score_away}</span>
                      </span>
                      {h.matches?.status === "finished" && (
                        <span className="inline-flex items-baseline gap-1">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Result</span>
                          <span className="score-num text-xs">{h.matches.score_home_ft}–{h.matches.score_away_ft}</span>
                        </span>
                      )}
                      {chip && (
                        <span
                          className="pill bg-secondary text-secondary-foreground"
                          title={`${CHIP_META[chip].label}: ${CHIP_META[chip].description}`}
                        >
                          {CHIP_META[chip].emoji} {CHIP_META[chip].label}
                        </span>
                      )}
                      {h.points_awarded !== null && (
                        <span className={`pill ${h.points_awarded === 3 ? "bg-success text-success-foreground" : h.points_awarded === 1 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>{h.points_awarded}</span>
                      )}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
