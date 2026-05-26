import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function genInviteCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export const createLeague = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ name: z.string().trim().min(1).max(60) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    for (let attempt = 0; attempt < 5; attempt++) {
      const invite_code = genInviteCode();
      const { data: league, error } = await supabase
        .from("leagues")
        .insert({ name: data.name, invite_code, created_by: userId })
        .select()
        .single();
      if (!error && league) {
        await supabase.from("league_members").insert({ league_id: league.id, user_id: userId });
        return { league };
      }
      if (error && !error.message.toLowerCase().includes("invite_code")) {
        throw new Error(error.message);
      }
    }
    throw new Error("Could not generate a unique invite code, please try again.");
  });

export const joinLeague = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ invite_code: z.string().trim().min(4).max(12) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const code = data.invite_code.trim().toUpperCase();
    const { data: league, error } = await supabase
      .from("leagues").select("id, name").eq("invite_code", code).maybeSingle();
    if (error) throw new Error(error.message);
    if (!league) throw new Error("Invite code not found.");
    const { error: insErr } = await supabase
      .from("league_members").insert({ league_id: league.id, user_id: userId });
    if (insErr && !insErr.message.includes("duplicate")) throw new Error(insErr.message);
    return { league };
  });

export const leaveLeague = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ league_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("league_members").delete()
      .eq("league_id", data.league_id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ league_id: z.string().uuid(), user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: league } = await supabase.from("leagues").select("created_by").eq("id", data.league_id).single();
    if (!league || league.created_by !== userId) throw new Error("Only the creator can remove members.");
    const { error } = await supabase.from("league_members").delete()
      .eq("league_id", data.league_id).eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const submitPrediction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      match_id: z.number().int(),
      score_home: z.number().int().min(0).max(20),
      score_away: z.number().int().min(0).max(20),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const winner: "home" | "draw" | "away" =
      data.score_home > data.score_away ? "home" :
      data.score_home < data.score_away ? "away" : "draw";
    const { error } = await supabase
      .from("predictions")
      .upsert({
        user_id: userId,
        match_id: data.match_id,
        predicted_winner: winner,
        predicted_score_home: data.score_home,
        predicted_score_away: data.score_away,
      }, { onConflict: "user_id,match_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateDisplayName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ display_name: z.string().trim().min(1).max(40) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("profiles").update({ display_name: data.display_name }).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
