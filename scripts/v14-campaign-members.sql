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
  CONSTRAINT campaign_members_unique UNIQUE (campaign_id, user_id),
  CONSTRAINT campaign_members_role_check CHECK (role IN ('Owner', 'DM', 'Player'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_members_campaign_id ON public.campaign_members(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_members_user_id ON public.campaign_members(user_id);

-- Enable RLS
ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view campaign members for campaigns they belong to" ON public.campaign_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.campaign_members cm 
      WHERE cm.campaign_id = campaign_members.campaign_id 
      AND cm.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.campaigns c 
      WHERE c.id = campaign_members.campaign_id 
      AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Campaign owners can manage members" ON public.campaign_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c 
      WHERE c.id = campaign_members.campaign_id 
      AND c.owner_id = auth.uid()
    )
  );

-- Grant permissions
GRANT ALL ON public.campaign_members TO authenticated;
GRANT ALL ON public.campaign_members TO service_role;
