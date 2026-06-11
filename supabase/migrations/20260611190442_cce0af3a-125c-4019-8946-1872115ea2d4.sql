DROP POLICY IF EXISTS "Read others chips for locked matches in shared leagues" ON public.match_chips;
CREATE POLICY "Read others chips for locked matches in shared leagues"
ON public.match_chips
FOR SELECT
TO authenticated
USING (
  auth.uid() <> user_id
  AND EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_chips.match_id
      AND m.prediction_lock_utc IS NOT NULL
      AND now() >= m.prediction_lock_utc
  )
  AND public.shares_league(auth.uid(), user_id)
);