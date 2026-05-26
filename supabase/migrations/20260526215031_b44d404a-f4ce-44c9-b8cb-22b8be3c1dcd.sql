
ALTER FUNCTION public.set_prediction_lock() SET search_path = public;
ALTER FUNCTION public.enforce_prediction_lock() SET search_path = public;
ALTER FUNCTION public.on_match_finished() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.is_league_member(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.shares_league(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.score_predictions(BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
