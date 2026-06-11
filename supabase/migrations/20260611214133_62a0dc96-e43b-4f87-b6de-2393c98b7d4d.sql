CREATE OR REPLACE FUNCTION public.enforce_prediction_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE lock_ts TIMESTAMPTZ;
BEGIN
  -- Allow internal scoring updates (only points_awarded changes)
  IF TG_OP = 'UPDATE'
     AND NEW.predicted_score_home IS NOT DISTINCT FROM OLD.predicted_score_home
     AND NEW.predicted_score_away IS NOT DISTINCT FROM OLD.predicted_score_away
     AND NEW.predicted_winner IS NOT DISTINCT FROM OLD.predicted_winner
     AND NEW.match_id IS NOT DISTINCT FROM OLD.match_id
     AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  SELECT prediction_lock_utc INTO lock_ts FROM public.matches WHERE id = NEW.match_id;
  IF lock_ts IS NULL OR now() >= lock_ts THEN
    RAISE EXCEPTION 'Predictions are locked for this match' USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $function$;