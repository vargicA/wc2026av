import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ChipType = z.enum(["double_down", "insurance", "all_in"]);

export const applyChip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ match_id: z.number().int(), chip_type: ChipType }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Replace any existing chip on that match (only one chip per match).
    const { error: delErr } = await supabase
      .from("match_chips")
      .delete()
      .eq("user_id", userId)
      .eq("match_id", data.match_id);
    if (delErr) throw new Error(delErr.message);

    const { error } = await supabase.from("match_chips").insert({
      user_id: userId,
      match_id: data.match_id,
      chip_type: data.chip_type,
    });
    if (error) {
      if (error.message.includes("match_chips_user_id_chip_type_key") || error.message.includes("duplicate")) {
        throw new Error("You've already used that chip on another match.");
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const removeChip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ match_id: z.number().int() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("match_chips")
      .delete()
      .eq("user_id", userId)
      .eq("match_id", data.match_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setBanker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      team_code: z.string().trim().min(2).max(8),
      team_name: z.string().trim().min(1).max(60),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_bankers")
      .upsert({
        user_id: userId,
        team_code: data.team_code.toUpperCase(),
        team_name: data.team_name,
      }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
