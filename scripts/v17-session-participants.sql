-- 018_sessions_participants.sql
CREATE TABLE IF NOT EXISTS public.session_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  user_id text NOT NULL,
  joined_at timestamptz DEFAULT now(),
  CONSTRAINT session_participants_pkey PRIMARY KEY (id),
  CONSTRAINT session_participants_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE,
  CONSTRAINT session_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT session_participants_unique UNIQUE (session_id, user_id)
);

-- Enable RLS
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see participants for sessions they're in
CREATE POLICY "Users can view session participants" ON public.session_participants
  FOR SELECT USING (
    user_id = auth.jwt() ->> 'sub' OR
    session_id IN (
      SELECT session_id FROM public.session_participants 
      WHERE user_id = auth.jwt() ->> 'sub'
    )
  );

-- Policy: Campaign owners can manage session participants
CREATE POLICY "Campaign owners can manage session participants" ON public.session_participants
  FOR ALL USING (
    session_id IN (
      SELECT id FROM public.sessions s
      WHERE s.campaign_id IN (
        SELECT id FROM public.campaigns 
        WHERE owner_id = auth.jwt() ->> 'sub'
      )
    )
  );
