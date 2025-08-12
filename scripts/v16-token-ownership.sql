-- Migration: Add token ownership and control columns
-- This enables per-token ownership and movement permissions

ALTER TABLE public.tokens
  ADD COLUMN IF NOT EXISTS owner_id text NULL,   -- user id who controls it (nullable)
  ADD COLUMN IF NOT EXISTS controlled_by_character_id uuid NULL, -- if token represents a character
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS position jsonb DEFAULT '{"x": 0, "y": 0}'::jsonb; -- token position on map

-- Add foreign key constraints
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tokens_owner_id_fkey'
  ) THEN
    ALTER TABLE public.tokens
      ADD CONSTRAINT tokens_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tokens_controlled_by_character_id_fkey'
  ) THEN
    ALTER TABLE public.tokens
      ADD CONSTRAINT tokens_controlled_by_character_id_fkey FOREIGN KEY (controlled_by_character_id) REFERENCES public.characters(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Update RLS policies for tokens
DROP POLICY IF EXISTS "Users can view tokens in sessions they participate in" ON public.tokens;
DROP POLICY IF EXISTS "Users can update tokens they own" ON public.tokens;

CREATE POLICY "Users can view tokens in sessions they participate in" ON public.tokens
  FOR SELECT USING (
    session_id IN (
      SELECT session_id FROM public.session_participants WHERE user_id = auth.uid()
    ) OR
    session_id IN (
      SELECT id FROM public.sessions WHERE campaign_id IN (
        SELECT id FROM public.campaigns WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update tokens they own" ON public.tokens
  FOR UPDATE USING (
    owner_id = auth.uid() OR
    session_id IN (
      SELECT id FROM public.sessions WHERE campaign_id IN (
        SELECT id FROM public.campaigns WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert tokens in sessions they participate in" ON public.tokens
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT session_id FROM public.session_participants WHERE user_id = auth.uid()
    ) OR
    session_id IN (
      SELECT id FROM public.sessions WHERE campaign_id IN (
        SELECT id FROM public.campaigns WHERE owner_id = auth.uid()
      )
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tokens_owner_id ON public.tokens(owner_id);
CREATE INDEX IF NOT EXISTS idx_tokens_character_id ON public.tokens(controlled_by_character_id);
CREATE INDEX IF NOT EXISTS idx_tokens_session_id ON public.tokens(session_id);
