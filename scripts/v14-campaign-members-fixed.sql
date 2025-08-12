-- Migration v14: Add campaign_members table (CORRECTED VERSION)
-- This fixes the type mismatch issues from the previous attempt

CREATE TABLE IF NOT EXISTS public.campaign_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  user_id text NOT NULL,
  role text NOT NULL DEFAULT 'Player',
  joined_at timestamptz NOT NULL DEFAULT now(),
  added_by text,
  CONSTRAINT campaign_members_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_members_unique UNIQUE (campaign_id, user_id),
  CONSTRAINT campaign_members_role_check CHECK (role IN ('Owner', 'DM', 'Player'))
);

-- Add foreign key to campaigns table (uuid to uuid - this should work)
ALTER TABLE public.campaign_members 
  ADD CONSTRAINT campaign_members_campaign_id_fkey 
  FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;

-- Skip user foreign key for now since it's causing type issues
-- We'll handle user validation in the application layer

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_members_campaign_id ON public.campaign_members(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_members_user_id ON public.campaign_members(user_id);

-- Enable RLS
ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;

-- Simple RLS policies without complex joins that might cause issues
CREATE POLICY "Users can view campaign members" ON public.campaign_members
  FOR SELECT USING (
    user_id = (SELECT auth.uid()::text)
    OR 
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE owner_id = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY "Campaign owners can insert members" ON public.campaign_members
  FOR INSERT WITH CHECK (
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE owner_id = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY "Campaign owners can update members" ON public.campaign_members
  FOR UPDATE USING (
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE owner_id = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY "Campaign owners can delete members" ON public.campaign_members
  FOR DELETE USING (
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE owner_id = (SELECT auth.uid()::text)
    )
  );

-- Grant necessary permissions
GRANT ALL ON public.campaign_members TO authenticated;
GRANT ALL ON public.campaign_members TO service_role;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
