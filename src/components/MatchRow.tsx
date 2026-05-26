import { Link } from "@tanstack/react-router";
import { fmtTime, teamFlag, countdownTo } from "@/lib/format";

export interface MatchRowData {
  id: number;
  team_home: string;
  team_away: string;
  team_home_code: string | null;
  team_away_code: string | null;
  kickoff_utc: string;
  prediction_lock_utc: string;
  status: string;
  score_home_ft: number | null;
  score_away_ft: number | null;
  stage: string;
  group_label: string | null;
}

export function MatchRow({ m, predicted, points }: { m: MatchRowData; predicted?: { h: number; a: number } | null; points?: number | null }) {
  const finished = m.status === "finished";
  const live = m.status === "live";
  const cd = countdownTo(m.prediction_lock_utc);

  return (
    <Link
      to="/matches/$matchId"
      params={{ matchId: String(m.id) }}
      className="block rounded-lg border border-border bg-card hover:border-primary/50 transition-colors p-3"
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span className="pill bg-secondary text-secondary-foreground">
          {m.stage === "group" ? `Group ${m.group_label}` : m.stage.toUpperCase()}
        </span>
        <span className="tabular">
          {live ? <span className="text-destructive font-medium">● LIVE</span>
            : finished ? "FT"
            : cd.locked ? "Locked" : `Locks in ${cd.text}`}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 text-right truncate">
          <span className="mr-2 text-lg">{teamFlag(m.team_home_code)}</span>
          <span className="font-medium">{m.team_home}</span>
        </div>
        <div className="score-num text-xl min-w-[64px] text-center">
          {finished || live ? (
            <span>{m.score_home_ft ?? "–"}<span className="text-muted-foreground mx-1">·</span>{m.score_away_ft ?? "–"}</span>
          ) : (
            <span className="text-muted-foreground text-sm font-sans tabular">{fmtTime(m.kickoff_utc)}</span>
          )}
        </div>
        <div className="flex-1 truncate">
          <span className="font-medium">{m.team_away}</span>
          <span className="ml-2 text-lg">{teamFlag(m.team_away_code)}</span>
        </div>
      </div>
      {(predicted || points !== undefined) && (
        <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {predicted ? <>Your pick: <span className="tabular font-medium text-foreground">{predicted.h}–{predicted.a}</span></> : "No prediction"}
          </span>
          {points !== null && points !== undefined && (
            <span className={`pill ${points === 3 ? "bg-success text-success-foreground" : points === 1 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
              {points} pt{points === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
