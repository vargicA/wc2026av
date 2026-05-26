
-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- LEAGUES
CREATE TABLE public.leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  invite_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_leagues_invite_code ON public.leagues(invite_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leagues TO authenticated;
GRANT ALL ON public.leagues TO service_role;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

-- LEAGUE MEMBERS
CREATE TABLE public.league_members (
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, user_id)
);
CREATE INDEX idx_league_members_user ON public.league_members(user_id);
GRANT SELECT, INSERT, DELETE ON public.league_members TO authenticated;
GRANT ALL ON public.league_members TO service_role;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_league_member(_league_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.league_members WHERE league_id = _league_id AND user_id = _user_id);
$$;
CREATE OR REPLACE FUNCTION public.shares_league(_user_a UUID, _user_b UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.league_members a
    JOIN public.league_members b ON a.league_id = b.league_id
    WHERE a.user_id = _user_a AND b.user_id = _user_b
  );
$$;

CREATE POLICY "Members read their leagues" ON public.leagues FOR SELECT TO authenticated
  USING (public.is_league_member(id, auth.uid()) OR created_by = auth.uid());
CREATE POLICY "Authenticated create leagues" ON public.leagues FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator updates league" ON public.leagues FOR UPDATE TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Creator deletes league" ON public.leagues FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Members read membership rows in their leagues" ON public.league_members FOR SELECT TO authenticated
  USING (public.is_league_member(league_id, auth.uid()));
CREATE POLICY "Users join leagues themselves" ON public.league_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users leave or creator removes" ON public.league_members FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = league_id AND l.created_by = auth.uid())
  );

-- MATCHES
CREATE TABLE public.matches (
  id BIGINT PRIMARY KEY,
  team_home TEXT NOT NULL,
  team_away TEXT NOT NULL,
  team_home_code TEXT,
  team_away_code TEXT,
  kickoff_utc TIMESTAMPTZ NOT NULL,
  prediction_lock_utc TIMESTAMPTZ NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('group','r32','r16','qf','sf','third','final')),
  group_label TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','finished','postponed','cancelled')),
  score_home_ft INT,
  score_away_ft INT,
  score_home_et INT,
  score_away_et INT,
  went_to_pens BOOLEAN NOT NULL DEFAULT false,
  pens_winner TEXT CHECK (pens_winner IN ('home','away') OR pens_winner IS NULL),
  matchday INT,
  last_synced_at TIMESTAMPTZ
);
CREATE INDEX idx_matches_kickoff ON public.matches(kickoff_utc);
CREATE INDEX idx_matches_status ON public.matches(status);
GRANT SELECT ON public.matches TO authenticated, anon;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Matches public read" ON public.matches FOR SELECT TO authenticated, anon USING (true);

CREATE OR REPLACE FUNCTION public.set_prediction_lock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.prediction_lock_utc := NEW.kickoff_utc - interval '2 hours';
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_matches_set_lock
  BEFORE INSERT OR UPDATE OF kickoff_utc ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.set_prediction_lock();

-- PREDICTIONS
CREATE TABLE public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id BIGINT NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  predicted_winner TEXT NOT NULL CHECK (predicted_winner IN ('home','draw','away')),
  predicted_score_home INT NOT NULL CHECK (predicted_score_home BETWEEN 0 AND 20),
  predicted_score_away INT NOT NULL CHECK (predicted_score_away BETWEEN 0 AND 20),
  points_awarded INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, match_id)
);
CREATE INDEX idx_predictions_user ON public.predictions(user_id);
CREATE INDEX idx_predictions_match ON public.predictions(match_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.predictions TO authenticated;
GRANT ALL ON public.predictions TO service_role;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enforce_prediction_lock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE lock_ts TIMESTAMPTZ;
BEGIN
  SELECT prediction_lock_utc INTO lock_ts FROM public.matches WHERE id = NEW.match_id;
  IF lock_ts IS NULL OR now() >= lock_ts THEN
    RAISE EXCEPTION 'Predictions are locked for this match' USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER predictions_lock_check
  BEFORE INSERT OR UPDATE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_prediction_lock();

CREATE POLICY "Users read own predictions" ON public.predictions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Read others predictions for finished matches in shared leagues" ON public.predictions FOR SELECT TO authenticated
  USING (
    auth.uid() <> user_id
    AND EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND m.status = 'finished')
    AND public.shares_league(auth.uid(), user_id)
  );
CREATE POLICY "Users insert own predictions" ON public.predictions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own predictions" ON public.predictions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own predictions" ON public.predictions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- SCORING
CREATE OR REPLACE FUNCTION public.score_predictions(_match_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m RECORD; actual_home INT; actual_away INT; actual_winner TEXT;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = _match_id;
  IF m.status <> 'finished' THEN RETURN; END IF;
  actual_home := COALESCE(m.score_home_et, m.score_home_ft);
  actual_away := COALESCE(m.score_away_et, m.score_away_ft);
  IF actual_home IS NULL OR actual_away IS NULL THEN RETURN; END IF;
  IF actual_home > actual_away THEN actual_winner := 'home';
  ELSIF actual_home < actual_away THEN actual_winner := 'away';
  ELSE actual_winner := 'draw'; END IF;
  UPDATE public.predictions p SET points_awarded = CASE
    WHEN p.predicted_score_home = actual_home AND p.predicted_score_away = actual_away THEN 3
    WHEN p.predicted_winner = actual_winner THEN 1
    ELSE 0
  END WHERE p.match_id = _match_id;
END; $$;

CREATE OR REPLACE FUNCTION public.on_match_finished()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'finished' AND (OLD.status IS DISTINCT FROM 'finished' OR
     OLD.score_home_ft IS DISTINCT FROM NEW.score_home_ft OR
     OLD.score_away_ft IS DISTINCT FROM NEW.score_away_ft OR
     OLD.score_home_et IS DISTINCT FROM NEW.score_home_et OR
     OLD.score_away_et IS DISTINCT FROM NEW.score_away_et) THEN
    PERFORM public.score_predictions(NEW.id);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_match_finished
  AFTER UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.on_match_finished();

-- LEADERBOARD
CREATE OR REPLACE VIEW public.league_leaderboard
WITH (security_invoker = true) AS
SELECT
  lm.league_id, lm.user_id, pr.display_name, lm.joined_at,
  COALESCE(SUM(p.points_awarded), 0)::INT AS points,
  COUNT(*) FILTER (WHERE p.points_awarded = 3)::INT AS exact_count,
  COUNT(*) FILTER (WHERE p.points_awarded IS NOT NULL)::INT AS scored_count
FROM public.league_members lm
LEFT JOIN public.profiles pr ON pr.id = lm.user_id
LEFT JOIN public.predictions p ON p.user_id = lm.user_id
LEFT JOIN public.matches m ON m.id = p.match_id AND m.status = 'finished'
GROUP BY lm.league_id, lm.user_id, pr.display_name, lm.joined_at;
GRANT SELECT ON public.league_leaderboard TO authenticated;
