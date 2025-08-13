-- Migration v17: Add normalized session_participants table
-- This provides better querying and syncing than relying only on sessions.participants JSONB

CREATE TABLE IF NOT EXISTS public.session_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  user_id text NOT NULL,
  joined_at timestamptz DEFAULT now(),
  role text DEFAULT 'Player', -- 'Player' or 'DM'
  CONSTRAINT session_participants_pkey PRIMARY KEY (id),
  CONSTRAINT session_participants_unique UNIQUE (session_id, user_id)
);

-- Add foreign key constraint to sessions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'session_participants_session_id_fkey'
    AND table_name = 'session_participants'
  ) THEN
    ALTER TABLE public.session_participants 
      ADD CONSTRAINT session_participants_session_id_fkey 
      FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_session_participants_session_id ON public.session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_user_id ON public.session_participants(user_id);

-- Enable RLS
ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view session participants for sessions they're in" ON public.session_participants;
DROP POLICY IF EXISTS "Session owners can manage participants" ON public.session_participants;

-- RLS Policies
CREATE POLICY "Users can view session participants for sessions they're in" ON public.session_participants
  FOR SELECT USING (
    user_id = (SELECT auth.uid()::text)
    OR
    session_id IN (
      SELECT sp.session_id FROM public.session_participants sp WHERE sp.user_id = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY "Session participants can manage their own participation" ON public.session_participants
  FOR ALL USING (
    user_id = (SELECT auth.uid()::text)
  );

-- Grant permissions
GRANT ALL ON public.session_participants TO authenticated;
GRANT ALL ON public.session_participants TO service_role;

-- Populate existing session participants from sessions.participants JSONB
-- Handle both string arrays and object arrays in participants column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sessions' 
    AND column_name = 'participants' 
    AND table_schema = 'public'
  ) THEN
    
    -- First, handle simple string arrays (user IDs)
    INSERT INTO public.session_participants (session_id, user_id, role)
    SELECT 
      s.id as session_id,
      participant.value::text as user_id,
      'Player' as role
    FROM public.sessions s
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.participants, '[]'::jsonb)) AS participant(value)
    WHERE s.participants IS NOT NULL
      AND jsonb_typeof(s.participants) = 'array'
      AND jsonb_typeof(participant.value) = 'string'
    ON CONFLICT (session_id, user_id) DO NOTHING;
    
    -- Then, handle object arrays with userId and role properties
    INSERT INTO public.session_participants (session_id, user_id, role)
    SELECT 
      s.id as session_id,
      (participant.value->>'userId')::text as user_id,
      COALESCE((participant.value->>'role')::text, 'Player') as role
    FROM public.sessions s
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.participants, '[]'::jsonb)) AS participant(value)
    WHERE s.participants IS NOT NULL
      AND jsonb_typeof(s.participants) = 'array'
      AND jsonb_typeof(participant.value) = 'object'
      AND participant.value ? 'userId'
    ON CONFLICT (session_id, user_id) DO NOTHING;
    
  END IF;
END $$;
