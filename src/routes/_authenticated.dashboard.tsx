import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { MatchRow, type MatchRowData } from "@/components/MatchRow";
import { fmtKickoff, countdownTo, teamFlag } from "@/lib/format";
import { CHIP_META, CHIP_ORDER, type ChipType } from "@/lib/chips";
import { setBanker } from "@/lib/chips.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const setBankerFn = useServerFn(setBanker);

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
        .from("matches").select("*")
        .gte("kickoff_utc", new Date().toISOString())
        .order("kickoff_utc", { ascending: true })
        .limit(1).maybeSingle();
      if (error) throw error;
      return data as MatchRowData | null;
    },
  });

  // Tournament-start lock: banker can be picked only before the first match locks.
  const { data: firstLock } = useQuery({
    queryKey: ["first-lock"],
    queryFn: async () => {
      const { data } = await supabase
        .from("matches").select("prediction_lock_utc")
        .order("prediction_lock_utc", { ascending: true }).limit(1).maybeSingle();
      return data?.prediction_lock_utc ?? null;
    },
  });
  const bankerLocked = firstLock ? new Date(firstLock).getTime() <= Date.now() : false;

  // Teams list for banker picker — distinct from matches.
  const { data: teams } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data } = await supabase.from("matches").select("team_home, team_home_code, team_away, team_away_code");
      const set = new Map<string, string>();
      for (const r of data ?? []) {
        if (r.team_home_code) set.set(r.team_home_code, r.team_home);
        if (r.team_away_code) set.set(r.team_away_code, r.team_away);
      }
      return Array.from(set.entries()).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const { data: banker } = useQuery({
    queryKey: ["banker", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_bankers").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: myChips } = useQuery({
    queryKey: ["my-chips", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("match_chips")
        .select("chip_type, match_id, matches(team_home, team_away, kickoff_utc, status)")
        .eq("user_id", user!.id);
      return data ?? [];
    },
  });

  const usedByType = useMemo(() => {
    const m = new Map<ChipType, any>();
    for (const c of myChips ?? []) m.set(c.chip_type as ChipType, c);
    return m;
  }, [myChips]);

  const [pickCode, setPickCode] = useState("");
  const [changing, setChanging] = useState(false);
  const bankerMut = useMutation({
    mutationFn: async () => {
      const t = teams?.find((x) => x.code === pickCode);
      if (!t) throw new Error("Pick a team");
      return setBankerFn({ data: { team_code: t.code, team_name: t.name } });
    },
    onSuccess: () => {
      setChanging(false);
      setPickCode("");
      qc.invalidateQueries({ queryKey: ["banker"] });
    },
  });

  const showPicker = !bankerLocked && (!banker || changing);

  return (
    <main className="container-app py-6 space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/10 p-6 sm:p-8">
        <div className="flex items-center gap-6">
          <img src={wc26Logo} alt="FIFA World Cup 26" className="h-28 sm:h-36 w-auto drop-shadow-[0_0_30px_rgba(59,130,246,0.35)]" />
          <div>
            <h1 className="display text-3xl sm:text-4xl font-semibold leading-tight">World Cup 26</h1>
            <p className="text-sm text-muted-foreground mt-1">Pick scores. Play chips. Climb the leaderboard.</p>
          </div>
        </div>
      </section>
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

      {/* Banker team */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="display text-2xl font-semibold">Banker team 🏦</h2>
          {bankerLocked && <span className="text-xs text-muted-foreground">Locked for the tournament</span>}
        </div>
        {banker && !changing ? (
          <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flag-xl">{teamFlag(banker.team_code)}</span>
              <div>
                <div className="font-medium">{banker.team_name}</div>
                <div className="text-xs text-muted-foreground">Points doubled whenever they play.</div>
              </div>
            </div>
            {!bankerLocked && (
              <button
                onClick={() => setChanging(true)}
                className="text-xs text-muted-foreground hover:text-foreground">Change</button>
            )}
          </div>
        ) : bankerLocked && !banker ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            The tournament has started — banker selection is closed.
          </div>
        ) : showPicker ? (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Pick one team for the whole tournament. Whenever they play, your points on that match are doubled.
            </p>
            <div className="flex gap-2">
              <select
                value={pickCode}
                onChange={(e) => setPickCode(e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Choose a team…</option>
                {teams?.map((t) => (
                  <option key={t.code} value={t.code}>{t.name}</option>
                ))}
              </select>
              <button
                onClick={() => bankerMut.mutate()}
                disabled={!pickCode || bankerMut.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {bankerMut.isPending ? "Saving…" : "Lock in"}
              </button>
              {changing && (
                <button onClick={() => setChanging(false)} className="text-xs text-muted-foreground px-2">Cancel</button>
              )}
            </div>
            {bankerMut.isError && <p className="text-sm text-destructive">{(bankerMut.error as Error).message}</p>}
          </div>
        ) : null}
      </section>

      {/* Chip status */}
      <section>
        <h2 className="display text-2xl font-semibold mb-3">Your chips</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {CHIP_ORDER.map((type) => {
            const used = usedByType.get(type);
            const meta = CHIP_META[type];
            return (
              <div key={type} className={`rounded-lg border p-4 ${used ? "border-border bg-muted/40" : "border-primary/30 bg-card"}`}>
                <div className="flex items-center gap-2 font-medium">
                  <span className="text-xl">{meta.emoji}</span>{meta.label}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{meta.description}</div>
                <div className="mt-3 text-xs">
                  {used ? (
                    <span className="text-muted-foreground">
                      Applied to <span className="text-foreground font-medium">{used.matches?.team_home} vs {used.matches?.team_away}</span>
                    </span>
                  ) : (
                    <span className="text-primary">Available — apply on any unlocked match.</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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

      {/* Scoring explanation */}
      <section>
        <h2 className="display text-2xl font-semibold mb-3">How scoring works</h2>
        <div className="rounded-lg border border-border bg-card p-5 space-y-4 text-sm">
          <div>
            <div className="font-medium mb-1">Base points</div>
            <ul className="text-muted-foreground space-y-1 list-disc list-inside">
              <li><span className="text-foreground font-medium">3 pts</span> — exact score</li>
              <li><span className="text-foreground font-medium">1 pt</span> — correct winner (or draw)</li>
              <li><span className="text-foreground font-medium">0 pts</span> — anything else</li>
            </ul>
          </div>
          <div>
            <div className="font-medium mb-1">Bonus chips (one use each, only one chip per match)</div>
            <ul className="text-muted-foreground space-y-1">
              {CHIP_ORDER.map((c) => (
                <li key={c}>
                  <span className="text-foreground font-medium">{CHIP_META[c].emoji} {CHIP_META[c].label}:</span> {CHIP_META[c].description}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-medium mb-1">🏦 Banker team</div>
            <p className="text-muted-foreground">
              Pick one team before the tournament starts. Every time they play, your points on that match are doubled — stacks <em>on top</em> of any chip you applied.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
