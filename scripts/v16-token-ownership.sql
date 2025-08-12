-- 004_tokens_owner.sql
ALTER TABLE public.tokens
  ADD COLUMN owner_id text NULL,   -- user id who controls it (nullable)
  ADD COLUMN controlled_by_character_id uuid NULL, -- if token represents a character
  ADD COLUMN is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN position jsonb DEFAULT '{}'::jsonb; -- {x: number, y: number}

ALTER TABLE public.tokens
  ADD CONSTRAINT tokens_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT tokens_controlled_by_character_id_fkey FOREIGN KEY (controlled_by_character_id) REFERENCES public.characters(id) ON DELETE SET NULL;

-- Update RLS policies for tokens
DROP POLICY IF EXISTS "Participants can view tokens." ON public.tokens;
CREATE POLICY "Session participants can view tokens." ON public.tokens
  FOR SELECT USING (
    session_id IS NULL OR
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = tokens.session_id AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.participants) p WHERE (p->>'userId') = (auth.jwt()->>'sub')
      )
    ) OR
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = tokens.campaign_id AND (
        c.owner_id = (auth.jwt()->>'sub') OR
        EXISTS (SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = c.id AND cm.user_id = (auth.jwt()->>'sub'))
      )
    )
  );

CREATE POLICY "Token owners and DMs can manage tokens." ON public.tokens
  FOR ALL USING (
    owner_id = (auth.jwt()->>'sub') OR
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = tokens.session_id AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.participants) p 
        WHERE (p->>'userId') = (auth.jwt()->>'sub') AND p->>'role' = 'DM'
      )
    ) OR
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = tokens.campaign_id AND c.owner_id = (auth.jwt()->>'sub')
    )
  ) WITH CHECK (
    owner_id = (auth.jwt()->>'sub') OR
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = tokens.session_id AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.participants) p 
        WHERE (p->>'userId') = (auth.jwt()->>'sub') AND p->>'role' = 'DM'
      )
    ) OR
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = tokens.campaign_id AND c.owner_id = (auth.jwt()->>'sub')
    )
  );
