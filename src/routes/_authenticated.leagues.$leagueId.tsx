import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { leaveLeague, removeMember } from "@/lib/app.functions";
import { LeagueChat } from "@/components/LeagueChat";
import { getLeagueUnreadCounts } from "@/lib/league-chat.functions";

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
  const unreadFn = useServerFn(getLeagueUnreadCounts);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"leaderboard" | "chat">("leaderboard");

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

  const { data: unread } = useQuery({
    queryKey: ["league-unread"],
    queryFn: () => unreadFn(),
    refetchInterval: 30000,
  });
  const unreadHere = unread?.find((u) => u.league_id === leagueId)?.unread ?? 0;

  const leaveMut = useMutation({
    mutationFn: async () => leave({ data: { league_id: leagueId } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-leagues"] }); navigate({ to: "/dashboard" }); },
  });

  if (!league) return <main className="container-app py-6 text-muted-foreground">Loading…</main>;
  const isCreator = league.created_by === user?.id;
  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/invite/${league.invite_code}` : "";

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

      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setTab("leaderboard")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "leaderboard" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Leaderboard
        </button>
        <button
          onClick={() => setTab("chat")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 ${
            tab === "chat" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Chat
          {unreadHere > 0 && tab !== "chat" && (
            <span className="pill bg-primary text-primary-foreground text-[10px] px-1.5 min-w-[18px] text-center">
              {unreadHere}
            </span>
          )}
        </button>
      </div>

      {tab === "leaderboard" ? (
        <section>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-[36px_1fr_60px_60px] gap-2 px-3 py-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-border bg-secondary/40">
              <span>#</span><span>Member</span><span className="text-right">Exact</span><span className="text-right">Pts</span>
            </div>
            {(board ?? []).map((r: any, i) => {
              const isMe = r.user_id === user?.id;
              const isAdmin = r.user_id === league.created_by;
              return (
                <div key={r.user_id}
                  className={`grid grid-cols-[36px_1fr_60px_60px] gap-2 px-3 py-2.5 text-sm items-center ${isMe ? "bg-primary/10" : ""}`}>
                  <span className="tabular text-muted-foreground">{i + 1}</span>
                  <span className="flex items-center gap-2 truncate">
                    <Link
                      to={isMe ? "/profile" : "/players/$userId"}
                      params={isMe ? undefined : { userId: r.user_id }}
                      className="truncate font-medium hover:underline"
                    >
                      {r.display_name ?? "Member"}
                    </Link>
                    {isAdmin && <span className="pill bg-primary/20 text-primary text-[10px]">Admin</span>}
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
      ) : (
        <LeagueChat leagueId={leagueId} adminUserId={league.created_by} />
      )}

      <section className="pt-4 border-t border-border">
        <button onClick={() => { if (confirm("Leave this league?")) leaveMut.mutate(); }}
          className="text-sm text-destructive hover:underline">
          Leave league
        </button>
      </section>
    </main>
  );
}
