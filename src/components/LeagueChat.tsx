import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  sendLeagueMessage,
  deleteLeagueMessage,
  markLeagueRead,
} from "@/lib/league-chat.functions";

interface Props {
  leagueId: string;
  adminUserId: string;
}

interface ChatMessage {
  id: string;
  league_id: string;
  user_id: string;
  body: string;
  created_at: string;
  display_name?: string | null;
}

export function LeagueChat({ leagueId, adminUserId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const send = useServerFn(sendLeagueMessage);
  const del = useServerFn(deleteLeagueMessage);
  const markRead = useServerFn(markLeagueRead);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useQuery({
    queryKey: ["league-messages", leagueId],
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from("league_messages")
        .select("id, league_id, user_id, body, created_at")
        .eq("league_id", leagueId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as ChatMessage[];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (ids.length === 0) return rows;
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ids);
      const nameMap = new Map((profs ?? []).map((p: any) => [p.id, p.display_name]));
      return rows.map((r) => ({ ...r, display_name: nameMap.get(r.user_id) ?? "Member" }));
    },
  });

  // Realtime: invalidate on any change for this league
  useEffect(() => {
    const channel = supabase
      .channel(`league-messages-${leagueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "league_messages", filter: `league_id=eq.${leagueId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["league-messages", leagueId] });
          qc.invalidateQueries({ queryKey: ["league-unread"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId, qc]);

  // Mark as read whenever messages list changes & we're viewing
  useEffect(() => {
    if (!messages) return;
    markRead({ data: { league_id: leagueId } })
      .then(() => qc.invalidateQueries({ queryKey: ["league-unread"] }))
      .catch(() => {});
    // Instant jump on first render, smooth after
    endRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages, leagueId, markRead, qc]);

  const sendMut = useMutation({
    mutationFn: async (body: string) => send({ data: { league_id: leagueId, body } }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["league-messages", leagueId] });
    },
  });

  const delMut = useMutation({
    mutationFn: async (message_id: string) => del({ data: { message_id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["league-messages", leagueId] }),
  });

  const isAdmin = user?.id === adminUserId;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sendMut.isPending) return;
    sendMut.mutate(trimmed);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!messages || messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((m) => {
            const isMine = m.user_id === user?.id;
            const isFromAdmin = m.user_id === adminUserId;
            const canDelete = isMine || isAdmin;
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    isMine
                      ? "bg-primary text-primary-foreground"
                      : isFromAdmin
                        ? "bg-secondary border-l-2 border-primary"
                        : "bg-secondary"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs opacity-80 mb-0.5">
                    <span className="font-medium">{isMine ? "You" : m.display_name}</span>
                    {isFromAdmin && !isMine && (
                      <span className="pill bg-primary/20 text-primary text-[10px] px-1.5">Admin</span>
                    )}
                    <span className="tabular">
                      {new Date(m.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {canDelete && (
                      <button
                        onClick={() => {
                          if (confirm("Delete this message?")) delMut.mutate(m.id);
                        }}
                        className="ml-auto hover:opacity-100 opacity-60"
                        title="Delete"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={onSubmit} className="border-t border-border p-3 flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message"
          rows={1}
          maxLength={2000}
          className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={!text.trim() || sendMut.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
