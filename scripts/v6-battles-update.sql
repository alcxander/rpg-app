-- Allow DMs to update battles (e.g., initiative or names)
CREATE POLICY IF NOT EXISTS "DMs can update battles." ON public.battles
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = battles.session_id
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(s.participants) p
        WHERE (p->>'userId') = (auth.jwt()->>'sub') AND p->>'role' = 'DM'
      )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = battles.session_id
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(s.participants) p
        WHERE (p->>'userId') = (auth.jwt()->>'sub') AND p->>'role' = 'DM'
      )
  )
);
