-- Migration: Add normalized session_participants table
-- This provides better querying and syncing for session membership

CREATE TABLE IF NOT EXISTS public.session_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  user_id text NOT NULL,
  role text DEFAULT 'Player',
  joined_at timestamptz DEFAULT now(),
  CONSTRAINT session_participants_pkey PRIMARY KEY (id),
  CONSTRAINT session_participants_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE,
  CONSTRAINT session_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT session_participants_unique UNIQUE (session_id, user_id)
);

-- Enable RLS
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view session participants for sessions they're in" ON public.session_participants
  FOR SELECT USING (
    user_id = auth.uid() OR
    session_id IN (
      SELECT session_id FROM public.session_participants WHERE user_id = auth.uid()
    ) OR
    session_id IN (
      SELECT id FROM public.sessions WHERE campaign_id IN (
        SELECT id FROM public.campaigns WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Campaign owners can manage session participants" ON public.session_participants
  FOR ALL USING (
    session_id IN (
      SELECT id FROM public.sessions WHERE campaign_id IN (
        SELECT id FROM public.campaigns WHERE owner_id = auth.uid()
      )
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_session_participants_session_id ON public.session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_user_id ON public.session_participants(user_id);
