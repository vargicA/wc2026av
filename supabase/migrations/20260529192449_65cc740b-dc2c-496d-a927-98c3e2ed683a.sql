
-- Bonus chips per user per match
CREATE TABLE public.match_chips (
  user_id uuid NOT NULL,
  match_id bigint NOT NULL,
  chip_type text NOT NULL CHECK (chip_type IN ('double_down','insurance','all_in')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, match_id),
  UNIQUE (user_id, chip_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_chips TO authenticated;
GRANT ALL ON public.match_chips TO service_role;

ALTER TABLE public.match_chips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own chips" ON public.match_chips
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Read others chips for finished matches in shared leagues" ON public.match_chips
  FOR SELECT TO authenticated USING (
    auth.uid() <> user_id
    AND EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_chips.match_id AND m.status = 'finished')
    AND public.shares_league(auth.uid(), user_id)
  );

CREATE POLICY "Users insert own chips" ON public.match_chips
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own chips" ON public.match_chips
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Banker team per user (locked once tournament starts)
CREATE TABLE public.user_bankers (
  user_id uuid PRIMARY KEY,
  team_code text NOT NULL,
  team_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_bankers TO authenticated;
GRANT ALL ON public.user_bankers TO service_role;

ALTER TABLE public.user_bankers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own banker" ON public.user_bankers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Read banker of league mates" ON public.user_bankers
  FOR SELECT TO authenticated USING (
    auth.uid() <> user_id AND public.shares_league(auth.uid(), user_id)
  );

CREATE POLICY "Users insert own banker" ON public.user_bankers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own banker" ON public.user_bankers
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Enforce: chips cannot change after the match is locked
CREATE OR REPLACE FUNCTION public.enforce_chip_lock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE lock_ts timestamptz; mid bigint;
BEGIN
  mid := COALESCE(NEW.match_id, OLD.match_id);
  SELECT prediction_lock_utc INTO lock_ts FROM public.matches WHERE id = mid;
  IF lock_ts IS NULL OR now() >= lock_ts THEN
    RAISE EXCEPTION 'Chips cannot be modified after the match is locked' USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER match_chips_lock_check
  BEFORE INSERT OR UPDATE OR DELETE ON public.match_chips
  FOR EACH ROW EXECUTE FUNCTION public.enforce_chip_lock();

-- Enforce: banker cannot change once any match has locked
CREATE OR REPLACE FUNCTION public.enforce_banker_lock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE first_lock timestamptz;
BEGIN
  SELECT MIN(prediction_lock_utc) INTO first_lock FROM public.matches;
  IF first_lock IS NOT NULL AND now() >= first_lock THEN
    RAISE EXCEPTION 'Banker cannot be changed once the tournament has started' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP <> 'DELETE' THEN NEW.updated_at := now(); END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER user_bankers_lock_check
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_bankers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_banker_lock();

-- Updated scoring: factor in chips + banker
CREATE OR REPLACE FUNCTION public.score_predictions(_match_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m RECORD;
  actual_home INT; actual_away INT; actual_winner TEXT;
  p RECORD;
  base INT; final INT;
  chip TEXT; banker TEXT;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = _match_id;
  IF m.status <> 'finished' THEN RETURN; END IF;
  actual_home := COALESCE(m.score_home_et, m.score_home_ft);
  actual_away := COALESCE(m.score_away_et, m.score_away_ft);
  IF actual_home IS NULL OR actual_away IS NULL THEN RETURN; END IF;
  IF actual_home > actual_away THEN actual_winner := 'home';
  ELSIF actual_home < actual_away THEN actual_winner := 'away';
  ELSE actual_winner := 'draw'; END IF;

  FOR p IN SELECT * FROM public.predictions WHERE match_id = _match_id LOOP
    base := CASE
      WHEN p.predicted_score_home = actual_home AND p.predicted_score_away = actual_away THEN 3
      WHEN p.predicted_winner = actual_winner THEN 1
      ELSE 0
    END;

    SELECT chip_type INTO chip FROM public.match_chips
      WHERE user_id = p.user_id AND match_id = _match_id;

    IF chip = 'double_down' THEN
      final := base * 2;
    ELSIF chip = 'insurance' THEN
      final := CASE WHEN base = 0 THEN 1 ELSE base END;
    ELSIF chip = 'all_in' THEN
      final := CASE WHEN base = 3 THEN 12 WHEN base = 1 THEN 2 ELSE -3 END;
    ELSE
      final := base;
    END IF;

    SELECT team_code INTO banker FROM public.user_bankers WHERE user_id = p.user_id;
    IF banker IS NOT NULL AND (banker = m.team_home_code OR banker = m.team_away_code) THEN
      final := final * 2;
    END IF;

    UPDATE public.predictions SET points_awarded = final WHERE id = p.id;
  END LOOP;
END; $$;
