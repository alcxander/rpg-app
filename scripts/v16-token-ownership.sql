-- Migration v16: Add token ownership and control columns

-- Add new columns to tokens table
ALTER TABLE public.tokens
  ADD COLUMN IF NOT EXISTS owner_id text,
  ADD COLUMN IF NOT EXISTS controlled_by_character_id uuid,
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS position jsonb DEFAULT '{}'::jsonb;

-- Add foreign key constraint for character control
ALTER TABLE public.tokens
  ADD CONSTRAINT IF NOT EXISTS tokens_controlled_by_character_id_fkey 
  FOREIGN KEY (controlled_by_character_id) REFERENCES public.characters(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tokens_owner_id ON public.tokens(owner_id);
CREATE INDEX IF NOT EXISTS idx_tokens_controlled_by_character_id ON public.tokens(controlled_by_character_id);

-- Update RLS policies for tokens
DROP POLICY IF EXISTS "Session participants can view tokens" ON public.tokens;

CREATE POLICY "Session participants can view tokens" ON public.tokens
  FOR SELECT USING (
    session_id IN (
      SELECT session_id FROM public.session_participants WHERE user_id = (SELECT auth.uid()::text)
    )
    OR
    session_id IN (
      SELECT id FROM public.sessions WHERE owner_id = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY "Token owners can update their tokens" ON public.tokens
  FOR UPDATE USING (
    owner_id = (SELECT auth.uid()::text)
    OR
    session_id IN (
      SELECT id FROM public.sessions WHERE owner_id = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY "Session owners can manage all tokens" ON public.tokens
  FOR ALL USING (
    session_id IN (
      SELECT id FROM public.sessions WHERE owner_id = (SELECT auth.uid()::text)
    )
  );
