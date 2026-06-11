CREATE OR REPLACE FUNCTION public.enforce_banker_lock()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE first_lock timestamptz; tournament_started boolean;
BEGIN
  SELECT MIN(prediction_lock_utc) INTO first_lock FROM public.matches;
  tournament_started := first_lock IS NOT NULL AND now() >= first_lock;

  IF tournament_started THEN
    IF TG_OP = 'INSERT' THEN
      -- New players can still pick their first banker after the tournament starts.
      NEW.updated_at := now();
      RETURN NEW;
    ELSE
      -- Existing bankers are locked once the tournament begins.
      RAISE EXCEPTION 'Banker cannot be changed once the tournament has started' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_OP <> 'DELETE' THEN NEW.updated_at := now(); END IF;
  RETURN COALESCE(NEW, OLD);
END; $function$