-- 014_create_campaign_members.sql
CREATE TABLE IF NOT EXISTS public.campaign_members (
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

-- Policy: Users can see campaign members for campaigns they belong to
CREATE POLICY "Users can view campaign members for their campaigns" ON public.campaign_members
  FOR SELECT USING (
    user_id = auth.jwt() ->> 'sub' OR
    campaign_id IN (
      SELECT campaign_id FROM public.campaign_members 
      WHERE user_id = auth.jwt() ->> 'sub'
    )
  );

-- Policy: Campaign owners can manage members
CREATE POLICY "Campaign owners can manage members" ON public.campaign_members
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM public.campaigns 
      WHERE owner_id = auth.jwt() ->> 'sub'
    )
  );
