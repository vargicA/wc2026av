DROP POLICY IF EXISTS "Users update own read-markers" ON public.league_message_reads;
CREATE POLICY "Users update own read-markers"
ON public.league_message_reads
FOR UPDATE
USING (auth.uid() = user_id AND public.is_league_member(league_id, auth.uid()))
WITH CHECK (auth.uid() = user_id AND public.is_league_member(league_id, auth.uid()));