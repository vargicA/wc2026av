import { Link } from "@tanstack/react-router";
import { fmtTime, teamFlag, countdownTo } from "@/lib/format";
import { CHIP_META, type ChipType } from "@/lib/chips";

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

export function MatchRow({
  m, predicted, points, chip, bankerHit,
}: {
  m: MatchRowData;
  predicted?: { h: number; a: number } | null;
  points?: number | null;
  chip?: ChipType | null;
  bankerHit?: boolean;
}) {
  const finished = m.status === "finished";
  const live = m.status === "live";
  const cd = countdownTo(m.prediction_lock_utc);

  return (
    <Link
      to="/matches/$matchId"
      params={{ matchId: String(m.id) }}
      className="block rounded-xl border border-border bg-card card-hover p-4"
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1.5">
          <span className="pill bg-secondary text-secondary-foreground">
            {m.stage === "group" ? `Group ${m.group_label}` : m.stage.toUpperCase()}
          </span>
          {chip && (
            <span className="pill bg-primary/15 text-primary border border-primary/30" title={CHIP_META[chip].label}>
              {CHIP_META[chip].emoji} {CHIP_META[chip].label}
            </span>
          )}
          {bankerHit && (
            <span className="pill bg-accent text-accent-foreground" title="Your Banker team is playing — points doubled">
              🏦 Banker
            </span>
          )}
        </span>
        <span className="tabular">
          {live ? <span className="text-destructive font-medium">● LIVE</span>
            : finished ? "FT"
            : cd.locked ? "Locked" : `Locks in ${cd.text}`}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex-1 min-w-0 flex flex-col items-center sm:flex-row sm:justify-end sm:items-center gap-1 sm:gap-3">
          <span className="order-2 sm:order-1 font-medium text-sm sm:text-base text-center sm:text-right break-words leading-tight">{m.team_home}</span>
          <span className="order-1 sm:order-2 flag-lg">{teamFlag(m.team_home_code)}</span>
        </div>
        <div className="score-num text-xl min-w-[56px] sm:min-w-[72px] text-center shrink-0">
          {finished || live ? (
            <span>{m.score_home_ft ?? "–"}<span className="text-muted-foreground mx-1">·</span>{m.score_away_ft ?? "–"}</span>
          ) : (
            <span className="text-muted-foreground text-sm font-sans tabular">{fmtTime(m.kickoff_utc)}</span>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col items-center sm:flex-row sm:items-center gap-1 sm:gap-3">
          <span className="flag-lg">{teamFlag(m.team_away_code)}</span>
          <span className="font-medium text-sm sm:text-base text-center sm:text-left break-words leading-tight">{m.team_away}</span>
        </div>
      </div>
      {(predicted || points !== undefined) && (
        <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {predicted ? <>Your pick: <span className="tabular font-medium text-foreground">{predicted.h}–{predicted.a}</span></> : "No prediction"}
          </span>
          {points !== null && points !== undefined && (
            <span className={`pill ${points >= 3 ? "bg-success text-success-foreground" : points >= 1 ? "bg-accent text-accent-foreground" : points < 0 ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"}`}>
              {points > 0 ? "+" : ""}{points} pt{Math.abs(points) === 1 ? "" : "s"}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
