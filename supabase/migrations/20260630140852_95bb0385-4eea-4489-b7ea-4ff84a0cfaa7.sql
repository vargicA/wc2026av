CREATE OR REPLACE FUNCTION public.score_predictions(_match_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m RECORD;
  actual_home INT; actual_away INT; actual_winner TEXT;
  p RECORD;
  base INT; final INT;
  chip TEXT; banker TEXT;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = _match_id;
  IF m.status <> 'finished' THEN RETURN; END IF;
  -- Always score against the 90-minute regulation result. Extra time and
  -- penalty shootouts do not count toward prediction scoring.
  actual_home := m.score_home_ft;
  actual_away := m.score_away_ft;
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
END; $function$;