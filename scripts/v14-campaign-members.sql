-- Migration: Add campaign_members table for explicit membership tracking
-- This fixes the invite flow by creating proper campaign membership records

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

-- RLS Policies
CREATE POLICY "Users can view campaign members for campaigns they belong to" ON public.campaign_members
  FOR SELECT USING (
    user_id = auth.uid() OR 
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE owner_id = auth.uid()
    ) OR
    campaign_id IN (
      SELECT campaign_id FROM public.campaign_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Campaign owners can insert members" ON public.campaign_members
  FOR INSERT WITH CHECK (
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Campaign owners can delete members" ON public.campaign_members
  FOR DELETE USING (
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE owner_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_members_campaign_id ON public.campaign_members(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_members_user_id ON public.campaign_members(user_id);
