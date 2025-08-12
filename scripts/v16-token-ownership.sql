-- Migration v16: Add token ownership and control columns

ALTER TABLE public.tokens
  ADD COLUMN IF NOT EXISTS owner_id text NULL,
  ADD COLUMN IF NOT EXISTS controlled_by_character_id uuid NULL,
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- Add foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tokens_controlled_by_character_id_fkey'
  ) THEN
    ALTER TABLE public.tokens
      ADD CONSTRAINT tokens_controlled_by_character_id_fkey 
      FOREIGN KEY (controlled_by_character_id) REFERENCES public.characters(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tokens_owner_id ON public.tokens(owner_id);
CREATE INDEX IF NOT EXISTS idx_tokens_controlled_by_character_id ON public.tokens(controlled_by_character_id);

-- Update RLS policies for tokens
DROP POLICY IF EXISTS "Session participants can view tokens" ON public.tokens;
DROP POLICY IF EXISTS "Session participants can manage tokens" ON public.tokens;

CREATE POLICY "Session participants can view tokens" ON public.tokens
  FOR SELECT USING (
    session_id IN (
      SELECT session_id FROM public.session_participants WHERE user_id = (SELECT auth.uid()::text)
    )
    OR
    session_id IN (
      SELECT id FROM public.sessions WHERE created_by = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY "Token owners and DMs can manage tokens" ON public.tokens
  FOR ALL USING (
    owner_id = (SELECT auth.uid()::text)
    OR
    session_id IN (
      SELECT id FROM public.sessions WHERE created_by = (SELECT auth.uid()::text)
    )
  );
