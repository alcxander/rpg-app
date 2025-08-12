-- 005_sessions_participants.sql
CREATE TABLE public.session_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL DEFAULT 'Player', -- 'DM' or 'Player'
  joined_at timestamptz DEFAULT now(),
  CONSTRAINT session_participants_pkey PRIMARY KEY (id),
  CONSTRAINT session_participants_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE,
  CONSTRAINT session_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT session_participants_unique UNIQUE (session_id, user_id)
);

-- Enable RLS
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Session participants can view session membership." ON public.session_participants
  FOR SELECT USING (
    user_id = (auth.jwt()->>'sub') OR
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_participants.session_id AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.participants) p 
        WHERE (p->>'userId') = (auth.jwt()->>'sub') AND p->>'role' = 'DM'
      )
    )
  );

CREATE POLICY "DMs can manage session participants." ON public.session_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_participants.session_id AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.participants) p 
        WHERE (p->>'userId') = (auth.jwt()->>'sub') AND p->>'role' = 'DM'
      )
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_participants.session_id AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.participants) p 
        WHERE (p->>'userId') = (auth.jwt()->>'sub') AND p->>'role' = 'DM'
      )
    )
  );

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_participants;
