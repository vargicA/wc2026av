
REVOKE EXECUTE ON FUNCTION public.score_predictions(bigint) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.enforce_chip_lock() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.enforce_banker_lock() FROM PUBLIC, authenticated, anon;
