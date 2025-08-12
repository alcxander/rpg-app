-- Create session_participants table
CREATE TABLE IF NOT EXISTS public.session_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL DEFAULT 'Player',
  joined_at timestamptz DEFAULT now(),
  CONSTRAINT session_participants_pkey PRIMARY KEY (id),
  CONSTRAINT session_participants_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE,
  CONSTRAINT session_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT session_participants_unique UNIQUE (session_id, user_id),
  CONSTRAINT session_participants_role_check CHECK (role IN ('DM', 'Player'))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_session_participants_session_id ON public.session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_user_id ON public.session_participants(user_id);

-- Enable RLS
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view session participants for their sessions" ON public.session_participants
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.session_participants sp
      WHERE sp.session_id = session_participants.session_id
      AND sp.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.campaigns c ON s.campaign_id = c.id
      WHERE s.id = session_participants.session_id
      AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Campaign owners can manage session participants" ON public.session_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.campaigns c ON s.campaign_id = c.id
      WHERE s.id = session_participants.session_id
      AND c.owner_id = auth.uid()
    )
  );

-- Grant permissions
GRANT ALL ON public.session_participants TO authenticated;
GRANT ALL ON public.session_participants TO service_role;
