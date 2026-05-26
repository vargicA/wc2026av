import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FD_URL = "https://api.football-data.org/v4/competitions/WC/matches";

function mapStage(s: string): string {
  const m: Record<string, string> = {
    GROUP_STAGE: "group", LAST_16: "r16", QUARTER_FINALS: "qf",
    SEMI_FINALS: "sf", THIRD_PLACE: "third", FINAL: "final",
    LAST_32: "r32", PRELIMINARY_ROUND: "group", PLAYOFFS: "r16",
  };
  return m[s] ?? "group";
}
function mapStatus(s: string): string {
  if (s === "FINISHED") return "finished";
  if (s === "IN_PLAY" || s === "PAUSED" || s === "LIVE") return "live";
  if (s === "POSTPONED") return "postponed";
  if (s === "CANCELLED" || s === "CANCELED" || s === "SUSPENDED") return "cancelled";
  return "scheduled";
}

export const Route = createFileRoute("/api/public/seed-once")({
  server: {
    handlers: {
      GET: async () => {
        const apiKey = process.env.FOOTBALL_DATA_API_KEY;
        if (!apiKey) return Response.json({ error: "Missing FOOTBALL_DATA_API_KEY" }, { status: 500 });
        const res = await fetch(FD_URL, { headers: { "X-Auth-Token": apiKey } });
        if (!res.ok) {
          const body = await res.text();
          return Response.json({ status: res.status, body: body.slice(0, 500) }, { status: 502 });
        }
        const json = await res.json();
        const matches: any[] = json.matches ?? [];
        const rows = matches.map((m) => {
          const ft = m.score?.fullTime ?? {};
          const et = m.score?.extraTime ?? {};
          const pens = m.score?.penalties ?? {};
          const wentToPens = pens.home != null && pens.away != null;
          const pensWinner = wentToPens ? (pens.home > pens.away ? "home" : "away") : null;
          return {
            id: m.id,
            team_home: m.homeTeam?.name ?? "TBD",
            team_away: m.awayTeam?.name ?? "TBD",
            team_home_code: m.homeTeam?.tla ?? null,
            team_away_code: m.awayTeam?.tla ?? null,
            kickoff_utc: m.utcDate,
            stage: mapStage(m.stage),
            group_label: m.group ? String(m.group).replace("GROUP_", "") : null,
            status: mapStatus(m.status),
            score_home_ft: ft.home ?? null,
            score_away_ft: ft.away ?? null,
            score_home_et: et.home ?? null,
            score_away_et: et.away ?? null,
            went_to_pens: wentToPens,
            pens_winner: pensWinner,
            matchday: m.matchday ?? null,
            last_synced_at: new Date().toISOString(),
          };
        });
        if (rows.length === 0) return Response.json({ synced: 0, note: "No matches returned by provider" });
        const { error } = await supabaseAdmin.from("matches").upsert(rows as any, { onConflict: "id" });
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ synced: rows.length });
      },
    },
  },
});
