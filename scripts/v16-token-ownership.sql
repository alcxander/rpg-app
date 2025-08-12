-- Migration: Add token ownership and control columns
-- Add columns to existing tokens table for ownership tracking

-- Add new columns to tokens table
ALTER TABLE public.tokens
  ADD COLUMN IF NOT EXISTS owner_id text NULL,   -- user id who controls it (nullable)
  ADD COLUMN IF NOT EXISTS controlled_by_character_id uuid NULL, -- if token represents a character
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS position jsonb DEFAULT '{}'::jsonb; -- {x: number, y: number, rotation?: number}

-- Add foreign key constraints
DO $$
BEGIN
  -- Add character foreign key constraint
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'tokens_controlled_by_character_id_fkey') THEN
    ALTER TABLE public.tokens
      ADD CONSTRAINT tokens_controlled_by_character_id_fkey 
      FOREIGN KEY (controlled_by_character_id) REFERENCES public.characters(id) ON DELETE SET NULL;
  END IF;

  -- Add user foreign key constraint if users table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' 
               AND column_name = 'id' 
               AND data_type = 'text' 
               AND table_schema = 'public') THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                     WHERE constraint_name = 'tokens_owner_id_fkey') THEN
        ALTER TABLE public.tokens
          ADD CONSTRAINT tokens_owner_id_fkey 
          FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;
      END IF;
    END IF;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tokens_owner_id ON public.tokens(owner_id);
CREATE INDEX IF NOT EXISTS idx_tokens_character_id ON public.tokens(controlled_by_character_id);
CREATE INDEX IF NOT EXISTS idx_tokens_session_id ON public.tokens(session_id);

-- Update RLS policies for tokens
DROP POLICY IF EXISTS "Users can view tokens in their sessions" ON public.tokens;
DROP POLICY IF EXISTS "Users can manage tokens they own" ON public.tokens;

-- New RLS policies
CREATE POLICY "Users can view tokens in sessions they participate in" ON public.tokens
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM public.sessions s
      WHERE s.owner_id = auth.uid()::text
      OR auth.uid()::text = ANY(
        SELECT jsonb_array_elements_text(s.participants)
      )
    )
  );

CREATE POLICY "Users can manage their own tokens" ON public.tokens
  FOR ALL USING (
    owner_id = auth.uid()::text
    OR
    session_id IN (
      SELECT id FROM public.sessions WHERE owner_id = auth.uid()::text
    )
  );

-- Grant permissions
GRANT ALL ON public.tokens TO authenticated;
GRANT ALL ON public.tokens TO service_role;
