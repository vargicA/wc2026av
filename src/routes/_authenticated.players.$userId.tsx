import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CHIP_META, type ChipType } from "@/lib/chips";

export const Route = createFileRoute("/_authenticated/players/$userId")({
  component: PlayerProfile,
});

function MatchWithBanker({
  home,
  away,
  homeCode,
  awayCode,
  bankerCode,
}: {
  home: string;
  away: string;
  homeCode: string | null;
  awayCode: string | null;
  bankerCode: string | null | undefined;
}) {
  const homeIsBanker = !!bankerCode && homeCode === bankerCode;
  const awayIsBanker = !!bankerCode && awayCode === bankerCode;
  return (
    <div className="truncate">
      {homeIsBanker ? (
        <span className="text-primary font-medium" title="Banker team — points doubled">{home} 🏦</span>
      ) : (
        home
      )}
      <span className="text-muted-foreground mx-1">vs</span>
      {awayIsBanker ? (
        <span className="text-primary font-medium" title="Banker team — points doubled">{away} 🏦</span>
      ) : (
        away
      )}
    </div>
  );
}

function PlayerProfile() {
  const { userId } = Route.useParams();

  const { data: profile } = useQuery({
    queryKey: ["player-profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
      return data;
    },
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["player-predictions", userId],
    queryFn: async () => {
      // RLS limits to predictions for matches that are locked AND in a shared league.
      const { data, error } = await supabase
        .from("predictions")
        .select("match_id, predicted_score_home, predicted_score_away, points_awarded, matches(team_home, team_away, team_home_code, team_away_code, kickoff_utc, score_home_ft, score_away_ft, status)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: banker } = useQuery({
    queryKey: ["player-banker", userId],
    queryFn: async () => {
      const { data } = await supabase.from("user_bankers").select("team_code").eq("user_id", userId).maybeSingle();
      return data;
    },
  });

  const { data: chips } = useQuery({
    queryKey: ["player-chips", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("match_chips")
        .select("match_id, chip_type")
        .eq("user_id", userId);
      const m = new Map<number, ChipType>();
      for (const c of data ?? []) m.set(c.match_id as number, c.chip_type as ChipType);
      return m;
    },
  });

  const totalPoints = (rows ?? []).reduce((s, r: any) => s + (r.points_awarded ?? 0), 0);

  return (
    <main className="container-app py-6 space-y-6">
      <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Back</Link>

      <header>
        <h1 className="display text-3xl font-semibold">{profile?.display_name ?? "Player"}</h1>
        <div className="mt-2 text-sm text-muted-foreground">
          Total points: <span className="score-num text-foreground">{totalPoints}</span>
        </div>
      </header>

      <section>
        <h2 className="display text-lg font-semibold mb-3">Predictions</h2>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : !rows || rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground text-sm">
            No visible predictions yet. Predictions become visible to league members once a match is locked (2 hours before kickoff).
          </div>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border">
            <div className="grid grid-cols-[minmax(0,1fr)_4rem_4rem_2.5rem] items-center gap-3 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40">
              <div className="truncate">Match</div>
              <div className="text-center">Pick</div>
              <div className="text-center">Result</div>
              <div className="text-center">Pts</div>
            </div>
            {rows.map((r: any) => {
              const finished = r.matches?.status === "finished";
              const actualHome = r.matches?.score_home_ft;
              const actualAway = r.matches?.score_away_ft;
              const chip = chips?.get(r.match_id) ?? null;
              return (
                <Link
                  key={r.match_id}
                  to="/matches/$matchId"
                  params={{ matchId: String(r.match_id) }}
                  className="grid grid-cols-[minmax(0,1fr)_4rem_4rem_2.5rem] items-center gap-3 px-3 py-3 hover:bg-accent/30 text-sm"
                >
                  <MatchWithBanker
                    home={r.matches?.team_home}
                    away={r.matches?.team_away}
                    homeCode={r.matches?.team_home_code}
                    awayCode={r.matches?.team_away_code}
                    bankerCode={banker?.team_code}
                  />
                  <div className="flex items-center justify-center gap-1 text-center">
                    <span className="tabular font-medium">{r.predicted_score_home}–{r.predicted_score_away}</span>
                    {chip && (
                      <span
                        className="text-xs"
                        title={`${CHIP_META[chip].label}: ${CHIP_META[chip].description}`}
                      >
                        {CHIP_META[chip].emoji}
                      </span>
                    )}
                  </div>
                  <div className="score-num text-xs text-center">
                    {finished && actualHome !== null && actualAway !== null ? `${actualHome}–${actualAway}` : "—"}
                  </div>
                  <div className="text-center">
                    {finished && r.points_awarded !== null ? (
                      <span className={`pill ${
                        r.points_awarded >= 3 ? "bg-success text-success-foreground" :
                        r.points_awarded === 1 || r.points_awarded === 2 ? "bg-accent text-accent-foreground" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {r.points_awarded}
                      </span>
                    ) : "—"}
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
