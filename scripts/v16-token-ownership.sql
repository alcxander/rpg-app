-- Add token ownership columns
ALTER TABLE public.tokens
  ADD COLUMN IF NOT EXISTS owner_id text NULL,
  ADD COLUMN IF NOT EXISTS controlled_by_character_id uuid NULL,
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

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

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'tokens_controlled_by_character_id_fkey'
  ) THEN
    ALTER TABLE public.tokens
      ADD CONSTRAINT tokens_controlled_by_character_id_fkey FOREIGN KEY (controlled_by_character_id) REFERENCES public.characters(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tokens_owner_id ON public.tokens(owner_id);
CREATE INDEX IF NOT EXISTS idx_tokens_character_id ON public.tokens(controlled_by_character_id);

-- Update RLS policies for tokens
DROP POLICY IF EXISTS "Users can view tokens in their sessions" ON public.tokens;
DROP POLICY IF EXISTS "Users can manage tokens in their sessions" ON public.tokens;

CREATE POLICY "Users can view tokens in accessible sessions" ON public.tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = tokens.session_id
      AND (
        s.participants ? auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.session_participants sp
          WHERE sp.session_id = s.id AND sp.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can manage their own tokens" ON public.tokens
  FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Campaign owners can manage all tokens in their campaigns" ON public.tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.campaigns c ON s.campaign_id = c.id
      WHERE s.id = tokens.session_id
      AND c.owner_id = auth.uid()
    )
  );
