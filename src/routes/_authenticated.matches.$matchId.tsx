import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { submitPrediction } from "@/lib/app.functions";
import { applyChip, removeChip } from "@/lib/chips.functions";
import { CHIP_META, CHIP_ORDER, type ChipType } from "@/lib/chips";
import { fmtKickoff, countdownTo, teamFlag } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/matches/$matchId")({
  component: MatchPage,
});

function MatchPage() {
  const { matchId } = Route.useParams();
  const matchIdNum = Number(matchId);
  const { user } = useAuth();
  const qc = useQueryClient();
  const submit = useServerFn(submitPrediction);

  const { data: match, isLoading } = useQuery({
    queryKey: ["match", matchIdNum],
    queryFn: async () => {
      const { data, error } = await supabase.from("matches").select("*").eq("id", matchIdNum).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: myPred } = useQuery({
    queryKey: ["my-pred", matchIdNum, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("predictions").select("*")
        .eq("user_id", user!.id).eq("match_id", matchIdNum).maybeSingle();
      return data;
    },
  });

  const { data: otherPreds } = useQuery({
    queryKey: ["others-preds", matchIdNum],
    enabled: !!match && match.status === "finished",
    queryFn: async () => {
      const { data } = await supabase
        .from("predictions")
        .select("user_id, predicted_score_home, predicted_score_away, points_awarded, profiles:user_id(display_name)")
        .eq("match_id", matchIdNum);
      return data ?? [];
    },
  });

  const [h, setH] = useState(0);
  const [a, setA] = useState(0);
  useEffect(() => {
    if (myPred) { setH(myPred.predicted_score_home); setA(myPred.predicted_score_away); }
  }, [myPred]);

  const mut = useMutation({
    mutationFn: async () => submit({ data: { match_id: matchIdNum, score_home: h, score_away: a } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-pred", matchIdNum] });
      qc.invalidateQueries({ queryKey: ["my-preds"] });
    },
  });

  // Chips for this match (own) + which chip-types user has already used elsewhere
  const applyChipFn = useServerFn(applyChip);
  const removeChipFn = useServerFn(removeChip);
  const { data: myChips } = useQuery({
    queryKey: ["my-chips", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("match_chips").select("chip_type, match_id").eq("user_id", user!.id);
      return data ?? [];
    },
  });
  const myChipOnThisMatch = (myChips ?? []).find((c) => c.match_id === matchIdNum)?.chip_type as ChipType | undefined;
  const usedTypes = new Set((myChips ?? []).map((c) => c.chip_type as ChipType));

  const { data: banker } = useQuery({
    queryKey: ["banker", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_bankers").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const chipMut = useMutation({
    mutationFn: async (type: ChipType) => applyChipFn({ data: { match_id: matchIdNum, chip_type: type } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-chips"] }),
  });
  const removeChipMut = useMutation({
    mutationFn: async () => removeChipFn({ data: { match_id: matchIdNum } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-chips"] }),
  });

  if (isLoading || !match) return <main className="container-app py-6 text-muted-foreground">Loading…</main>;

  const lock = countdownTo(match.prediction_lock_utc);
  const isLocked = lock.locked;
  const finished = match.status === "finished";

  return (
    <main className="container-app py-6 space-y-6">
      <Link to="/fixtures" className="text-sm text-muted-foreground hover:text-foreground">← Fixtures</Link>

      <header>
        <div className="text-xs text-muted-foreground mb-1 tabular">
          {fmtKickoff(match.kickoff_utc)} · {match.stage === "group" ? `Group ${match.group_label}` : match.stage.toUpperCase()}
        </div>
        <div className="display text-3xl font-semibold flex items-center justify-center gap-4 py-4">
          <span className="flex-1 text-right">
            <span className="flag-xl block mb-2">{teamFlag(match.team_home_code)}</span>
            {match.team_home}
          </span>
          <span className="text-muted-foreground text-sm font-sans">vs</span>
          <span className="flex-1 text-left">
            <span className="flag-xl block mb-2">{teamFlag(match.team_away_code)}</span>
            {match.team_away}
          </span>
        </div>

        {finished && (
          <div className="text-center">
            <div className="score-num text-5xl">
              {match.score_home_ft}<span className="text-muted-foreground mx-2">·</span>{match.score_away_ft}
            </div>
            {match.went_to_pens && match.pens_winner && (
              <div className="text-sm text-muted-foreground mt-1">
                {match.pens_winner === "home" ? match.team_home : match.team_away} won on penalties
              </div>
            )}
          </div>
        )}
      </header>

      {/* Banker indicator */}
      {banker && (banker.team_code === match.team_home_code || banker.team_code === match.team_away_code) && (
        <div className="rounded-lg border border-accent bg-accent/20 px-3 py-2 text-sm">
          🏦 Your <span className="font-medium">{banker.team_name}</span> Banker is playing — points on this match are doubled.
        </div>
      )}

      {/* Bonus chips */}
      {!finished && (
        <section>
          <h2 className="display text-lg font-semibold mb-2">Bonus chip</h2>
          {isLocked ? (
            myChipOnThisMatch ? (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                {CHIP_META[myChipOnThisMatch].emoji} <span className="font-medium">{CHIP_META[myChipOnThisMatch].label}</span> locked in for this match.
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">Chips locked.</div>
            )
          ) : (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-3">
                {CHIP_ORDER.map((type) => {
                  const meta = CHIP_META[type];
                  const isApplied = myChipOnThisMatch === type;
                  const usedElsewhere = usedTypes.has(type) && !isApplied;
                  const disabled = usedElsewhere || chipMut.isPending;
                  return (
                    <button
                      key={type}
                      onClick={() => !isApplied && chipMut.mutate(type)}
                      disabled={disabled}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        isApplied ? "border-primary bg-primary/10"
                          : usedElsewhere ? "border-border bg-muted/40 opacity-60 cursor-not-allowed"
                          : "border-border bg-card hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>{meta.emoji} {meta.label}</span>
                        {isApplied && <span className="text-xs text-primary">Applied</span>}
                        {usedElsewhere && <span className="text-xs text-muted-foreground">Used</span>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{meta.description}</div>
                    </button>
                  );
                })}
              </div>
              {myChipOnThisMatch && (
                <button
                  onClick={() => removeChipMut.mutate()}
                  disabled={removeChipMut.isPending}
                  className="text-xs text-muted-foreground hover:text-destructive">
                  Remove {CHIP_META[myChipOnThisMatch].label}
                </button>
              )}
              {chipMut.isError && <p className="text-sm text-destructive">{(chipMut.error as Error).message}</p>}
              <p className="text-xs text-muted-foreground">Only one chip per match. Each chip can be used once for the whole tournament.</p>
            </div>
          )}
        </section>
      )}


      {!finished && (
        <section>
          <h2 className="display text-lg font-semibold mb-2">Your prediction</h2>
          {isLocked ? (
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
              <div className="text-muted-foreground mb-1">Predictions locked</div>
              {myPred ? (
                <div className="score-num text-2xl">{myPred.predicted_score_home} · {myPred.predicted_score_away}</div>
              ) : (
                <div>You didn't submit a prediction.</div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground mb-3 tabular">Locks in {lock.text}</div>
              <div className="flex items-center justify-center gap-6">
                <ScoreStepper value={h} setValue={setH} label={match.team_home} />
                <span className="text-3xl text-muted-foreground">·</span>
                <ScoreStepper value={a} setValue={setA} label={match.team_away} />
              </div>
              <div className="mt-4 text-center text-sm text-muted-foreground">
                Winner: <span className="text-foreground font-medium">
                  {h > a ? match.team_home : h < a ? match.team_away : "Draw"}
                </span>
              </div>
              <button
                onClick={() => mut.mutate()}
                disabled={mut.isPending}
                className="mt-4 w-full rounded-md bg-primary py-2.5 text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
              >
                {mut.isPending ? "Saving…" : myPred ? "Update prediction" : "Save prediction"}
              </button>
              {mut.isError && <p className="mt-2 text-sm text-destructive">{(mut.error as Error).message}</p>}
              {mut.isSuccess && <p className="mt-2 text-sm text-success">Saved.</p>}
            </div>
          )}
        </section>
      )}

      {finished && (
        <section>
          <h2 className="display text-lg font-semibold mb-2">Your result</h2>
          <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-between">
            {myPred ? (
              <>
                <div className="score-num text-2xl">{myPred.predicted_score_home} · {myPred.predicted_score_away}</div>
                <span className={`pill ${myPred.points_awarded === 3 ? "bg-success text-success-foreground" : myPred.points_awarded === 1 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                  {myPred.points_awarded ?? 0} pts
                </span>
              </>
            ) : <span className="text-muted-foreground text-sm">No prediction</span>}
          </div>
        </section>
      )}

      {finished && otherPreds && otherPreds.length > 0 && (
        <section>
          <h2 className="display text-lg font-semibold mb-2">League picks</h2>
          <div className="rounded-lg border border-border divide-y divide-border">
            {otherPreds
              .filter((p: any) => p.user_id !== user?.id)
              .sort((a: any, b: any) => (b.points_awarded ?? 0) - (a.points_awarded ?? 0))
              .map((p: any) => (
                <div key={p.user_id} className="flex items-center justify-between p-3 text-sm">
                  <span>{p.profiles?.display_name ?? "Someone"}</span>
                  <span className="flex items-center gap-3">
                    <span className="score-num">{p.predicted_score_home} · {p.predicted_score_away}</span>
                    <span className={`pill ${p.points_awarded === 3 ? "bg-success text-success-foreground" : p.points_awarded === 1 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>{p.points_awarded ?? 0}</span>
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}
    </main>
  );
}

function ScoreStepper({ value, setValue, label }: { value: number; setValue: (n: number) => void; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-xs text-muted-foreground mb-1 max-w-[88px] truncate">{label}</div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setValue(Math.max(0, value - 1))}
          className="w-9 h-9 rounded-full border border-input text-lg hover:bg-accent">−</button>
        <span className="score-num text-3xl w-10 text-center tabular">{value}</span>
        <button type="button" onClick={() => setValue(Math.min(20, value + 1))}
          className="w-9 h-9 rounded-full border border-input text-lg hover:bg-accent">+</button>
      </div>
    </div>
  );
}
