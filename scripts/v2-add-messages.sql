-- Messages table for session chat
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT REFERENCES public.sessions(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS: participants in session or campaign owner can read
CREATE POLICY "Participants and owners can read messages" ON public.messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = messages.session_id
      AND (
        EXISTS (SELECT 1 FROM jsonb_array_elements(s.participants) p WHERE (p->>'userId') = (auth.jwt()->>'sub'))
        OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = s.campaign_id AND c.owner_id = (auth.jwt()->>'sub'))
      )
  )
);

-- RLS: only authenticated participant can insert their own message
CREATE POLICY "Participants can insert messages" ON public.messages
FOR INSERT WITH CHECK (
  (auth.jwt()->>'sub') = user_id
  AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = messages.session_id
      AND (
        EXISTS (SELECT 1 FROM jsonb_array_elements(s.participants) p WHERE (p->>'userId') = (auth.jwt()->>'sub'))
        OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = s.campaign_id AND c.owner_id = (auth.jwt()->>'sub'))
      )
  )
);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
