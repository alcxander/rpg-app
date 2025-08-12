-- 001_create_campaign_members.sql
CREATE TABLE public.campaign_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL DEFAULT 'Player', -- 'DM' or 'Player'
  joined_at timestamptz NOT NULL DEFAULT now(),
  added_by text, -- user id that invited
  CONSTRAINT campaign_members_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_members_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE,
  CONSTRAINT campaign_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT campaign_members_unique UNIQUE (campaign_id, user_id)
);

-- Enable RLS
ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Campaign members can view their own membership." ON public.campaign_members
  FOR SELECT USING (
    user_id = (auth.jwt()->>'sub') OR
    EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_members.campaign_id AND c.owner_id = (auth.jwt()->>'sub'))
  );

CREATE POLICY "Campaign owners can manage members." ON public.campaign_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_members.campaign_id AND c.owner_id = (auth.jwt()->>'sub'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_members.campaign_id AND c.owner_id = (auth.jwt()->>'sub'))
  );

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_members;
