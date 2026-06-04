import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendLeagueMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      league_id: z.string().uuid(),
      body: z.string().trim().min(1).max(2000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("league_messages")
      .insert({ league_id: data.league_id, user_id: userId, body: data.body });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLeagueMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ message_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("league_messages")
      .delete()
      .eq("id", data.message_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markLeagueRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ league_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("league_message_reads")
      .upsert(
        { league_id: data.league_id, user_id: userId, last_read_at: new Date().toISOString() },
        { onConflict: "league_id,user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getLeagueUnreadCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: memberships, error: mErr } = await supabase
      .from("league_members")
      .select("league_id")
      .eq("user_id", userId);
    if (mErr) throw new Error(mErr.message);
    const leagueIds = (memberships ?? []).map((m) => m.league_id);
    if (leagueIds.length === 0) return [] as { league_id: string; unread: number }[];

    const { data: reads } = await supabase
      .from("league_message_reads")
      .select("league_id, last_read_at")
      .eq("user_id", userId);
    const readMap = new Map<string, string>((reads ?? []).map((r) => [r.league_id, r.last_read_at]));

    const { data: messages, error: msgErr } = await supabase
      .from("league_messages")
      .select("league_id, created_at, user_id")
      .in("league_id", leagueIds);
    if (msgErr) throw new Error(msgErr.message);

    const counts = new Map<string, number>();
    for (const id of leagueIds) counts.set(id, 0);
    for (const m of messages ?? []) {
      if (m.user_id === userId) continue;
      const lastRead = readMap.get(m.league_id);
      if (!lastRead || new Date(m.created_at) > new Date(lastRead)) {
        counts.set(m.league_id, (counts.get(m.league_id) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).map(([league_id, unread]) => ({ league_id, unread }));
  });
