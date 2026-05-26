import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { leaveLeague, removeMember } from "@/lib/app.functions";

export const Route = createFileRoute("/_authenticated/leagues/$leagueId")({
  component: LeagueView,
});

function LeagueView() {
  const { leagueId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const leave = useServerFn(leaveLeague);
  const remove = useServerFn(removeMember);
  const [copied, setCopied] = useState(false);

  const { data: league } = useQuery({
    queryKey: ["league", leagueId],
    queryFn: async () => {
      const { data, error } = await supabase.from("leagues").select("*").eq("id", leagueId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: board } = useQuery({
    queryKey: ["leaderboard", leagueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("league_leaderboard")
        .select("*")
        .eq("league_id", leagueId)
        .order("points", { ascending: false })
        .order("exact_count", { ascending: false })
        .order("joined_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!league) return <main className="container-app py-6 text-muted-foreground">Loading…</main>;
  const isCreator = league.created_by === user?.id;
  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/invite/${league.invite_code}` : "";

  const leaveMut = useMutation({
    mutationFn: async () => leave({ data: { league_id: leagueId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-leagues"] }); navigate({ to: "/dashboard" }); },
  });

  return (
    <main className="container-app py-6 space-y-6">
      <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Dashboard</Link>

      <header>
        <h1 className="display text-3xl font-semibold">{league.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="pill bg-secondary text-secondary-foreground tabular">Code: {league.invite_code}</span>
          <button onClick={() => { navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="rounded-md border border-input px-3 py-1 text-xs hover:bg-accent">
            {copied ? "Copied!" : "Copy invite link"}
          </button>
        </div>
      </header>

      <section>
        <h2 className="display text-xl font-semibold mb-3">Leaderboard</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-[36px_1fr_60px_60px] gap-2 px-3 py-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-border bg-secondary/40">
            <span>#</span><span>Member</span><span className="text-right">Exact</span><span className="text-right">Pts</span>
          </div>
          {(board ?? []).map((r: any, i) => {
            const isMe = r.user_id === user?.id;
            return (
              <div key={r.user_id}
                className={`grid grid-cols-[36px_1fr_60px_60px] gap-2 px-3 py-2.5 text-sm items-center ${isMe ? "bg-primary/10" : ""}`}>
                <span className="tabular text-muted-foreground">{i + 1}</span>
                <span className="flex items-center gap-2 truncate">
                  <span className="truncate font-medium">{r.display_name ?? "Member"}</span>
                  {isMe && <span className="pill bg-primary text-primary-foreground">you</span>}
                  {isCreator && !isMe && (
                    <button onClick={() => {
                      if (confirm(`Remove ${r.display_name}?`)) {
                        remove({ data: { league_id: leagueId, user_id: r.user_id } })
                          .then(() => qc.invalidateQueries({ queryKey: ["leaderboard", leagueId] }));
                      }
                    }} className="text-xs text-muted-foreground hover:text-destructive">remove</button>
                  )}
                </span>
                <span className="text-right tabular text-muted-foreground">{r.exact_count}</span>
                <span className="text-right score-num">{r.points}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="pt-4 border-t border-border">
        <button onClick={() => { if (confirm("Leave this league?")) leaveMut.mutate(); }}
          className="text-sm text-destructive hover:underline">
          Leave league
        </button>
      </section>
    </main>
  );
}
