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
  CONSTRAINT campaign_members_unique UNIQUE (campaign_id, user_id),
  CONSTRAINT campaign_members_role_check CHECK (role IN ('Owner', 'DM', 'Player'))
);

-- Add foreign key constraints separately with proper type handling
-- Note: campaigns.id is uuid, users.id is text (from Clerk)
ALTER TABLE public.campaign_members 
  ADD CONSTRAINT campaign_members_campaign_id_fkey 
  FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE CASCADE;

-- Only add user foreign key if users table exists and has text id
-- Check if users table exists first
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
    -- Check if users.id is text type
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'users' 
               AND column_name = 'id' 
               AND data_type = 'text' 
               AND table_schema = 'public') THEN
      ALTER TABLE public.campaign_members 
        ADD CONSTRAINT campaign_members_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_members_campaign_id ON public.campaign_members(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_members_user_id ON public.campaign_members(user_id);

-- Enable RLS
ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies - using auth.uid() which returns text
CREATE POLICY "Users can view campaign members for campaigns they belong to" ON public.campaign_members
  FOR SELECT USING (
    user_id = auth.uid()::text
    OR
    EXISTS (
      SELECT 1 FROM public.campaign_members cm 
      WHERE cm.campaign_id = campaign_members.campaign_id 
      AND cm.user_id = auth.uid()::text
    )
    OR
    EXISTS (
      SELECT 1 FROM public.campaigns c 
      WHERE c.id = campaign_members.campaign_id 
      AND c.owner_id = auth.uid()::text
    )
  );

CREATE POLICY "Campaign owners can manage members" ON public.campaign_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c 
      WHERE c.id = campaign_members.campaign_id 
      AND c.owner_id = auth.uid()::text
    )
  );

-- Grant permissions
GRANT ALL ON public.campaign_members TO authenticated;
GRANT ALL ON public.campaign_members TO service_role;
