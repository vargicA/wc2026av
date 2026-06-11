DROP POLICY IF EXISTS "Read others predictions for finished matches in shared leagues" ON public.predictions;

CREATE POLICY "Read others predictions for locked matches in shared leagues" ON public.predictions FOR SELECT TO authenticated
  USING (
    auth.uid() <> user_id
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND m.prediction_lock_utc IS NOT NULL
        AND now() >= m.prediction_lock_utc
    )
    AND public.shares_league(auth.uid(), user_id)
  );