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

-- Add foreign key constraint to users table (only if users table exists and has correct structure)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' 
               AND column_name = 'id' 
               AND data_type = 'text' 
               AND table_schema = 'public') THEN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'session_participants_user_id_fkey'
        AND table_name = 'session_participants'
      ) THEN
        ALTER TABLE public.session_participants 
          ADD CONSTRAINT session_participants_user_id_fkey 
          FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
      END IF;
    END IF;
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
      SELECT id FROM public.sessions WHERE owner_id = (SELECT auth.uid()::text)
    )
    OR
    session_id IN (
      SELECT session_id FROM public.session_participants WHERE user_id = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY "Session owners can manage participants" ON public.session_participants
  FOR ALL USING (
    session_id IN (
      SELECT id FROM public.sessions WHERE owner_id = (SELECT auth.uid()::text)
    )
  );

-- Grant permissions
GRANT ALL ON public.session_participants TO authenticated;
GRANT ALL ON public.session_participants TO service_role;

-- Populate existing session participants from sessions.participants JSONB
INSERT INTO public.session_participants (session_id, user_id, role)
SELECT 
  s.id as session_id,
  participant.value::text as user_id,
  CASE 
    WHEN participant.value::text = s.owner_id THEN 'DM'
    ELSE 'Player'
  END as role
FROM public.sessions s
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.participants, '[]'::jsonb)) AS participant(value)
WHERE s.participants IS NOT NULL
  AND jsonb_typeof(s.participants) = 'array'
ON CONFLICT (session_id, user_id) DO NOTHING;
