
-- League chat messages
CREATE TABLE public.league_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX league_messages_league_created_idx
  ON public.league_messages (league_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.league_messages TO authenticated;
GRANT ALL ON public.league_messages TO service_role;

ALTER TABLE public.league_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read league messages"
  ON public.league_messages FOR SELECT TO authenticated
  USING (public.is_league_member(league_id, auth.uid()));

CREATE POLICY "Members post own messages"
  ON public.league_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_league_member(league_id, auth.uid())
  );

CREATE POLICY "Senders delete own messages"
  ON public.league_messages FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "League creator deletes any message"
  ON public.league_messages FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.leagues l
    WHERE l.id = league_messages.league_id AND l.created_by = auth.uid()
  ));

-- Per-user read marker per league
CREATE TABLE public.league_message_reads (
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_message_reads TO authenticated;
GRANT ALL ON public.league_message_reads TO service_role;

ALTER TABLE public.league_message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own read-markers"
  ON public.league_message_reads FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own read-markers"
  ON public.league_message_reads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_league_member(league_id, auth.uid()));

CREATE POLICY "Users update own read-markers"
  ON public.league_message_reads FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Enable Realtime on messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.league_messages;
ALTER TABLE public.league_messages REPLICA IDENTITY FULL;
