-- 017_tokens_owner.sql
ALTER TABLE public.tokens
  ADD COLUMN IF NOT EXISTS owner_id text NULL,   -- user id who controls it (nullable)
  ADD COLUMN IF NOT EXISTS controlled_by_character_id uuid NULL, -- if token represents a character
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS position jsonb DEFAULT '{}'::jsonb; -- {x: number, y: number, gridX?: number, gridY?: number}

-- Add foreign key constraints if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'tokens_owner_id_fkey') THEN
    ALTER TABLE public.tokens
      ADD CONSTRAINT tokens_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'tokens_controlled_by_character_id_fkey') THEN
    ALTER TABLE public.tokens
      ADD CONSTRAINT tokens_controlled_by_character_id_fkey FOREIGN KEY (controlled_by_character_id) REFERENCES public.characters(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Update RLS policies for token ownership
DROP POLICY IF EXISTS "Users can view tokens in their sessions" ON public.tokens;
DROP POLICY IF EXISTS "Users can manage tokens in their sessions" ON public.tokens;

CREATE POLICY "Users can view tokens in accessible sessions" ON public.tokens
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM public.sessions s
      WHERE s.participants ? (auth.jwt() ->> 'sub')
      OR s.campaign_id IN (
        SELECT campaign_id FROM public.campaign_members 
        WHERE user_id = auth.jwt() ->> 'sub'
      )
    )
  );

CREATE POLICY "Users can manage their own tokens" ON public.tokens
  FOR ALL USING (
    owner_id = auth.jwt() ->> 'sub' OR
    session_id IN (
      SELECT id FROM public.sessions s
      WHERE s.campaign_id IN (
        SELECT id FROM public.campaigns 
        WHERE owner_id = auth.jwt() ->> 'sub'
      )
    )
  );
