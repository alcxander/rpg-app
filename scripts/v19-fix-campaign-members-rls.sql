-- Migration v19: Fix campaign_members RLS policies to avoid infinite recursion
-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view campaign members" ON public.campaign_members;
DROP POLICY IF EXISTS "Campaign owners can insert members" ON public.campaign_members;
DROP POLICY IF EXISTS "Campaign owners can update members" ON public.campaign_members;
DROP POLICY IF EXISTS "Campaign owners can delete members" ON public.campaign_members;

-- Create simpler RLS policies that don't cause recursion
-- Users can view members of campaigns they belong to
CREATE POLICY "Members can view campaign members" ON public.campaign_members
  FOR SELECT USING (
    -- User can see members of campaigns they are a member of
    campaign_id IN (
      SELECT campaign_id FROM public.campaign_members WHERE user_id = (SELECT auth.uid()::text)
    )
    OR
    -- Or if they own the campaign (direct check without join)
    EXISTS (
      SELECT 1 FROM public.campaigns 
      WHERE campaigns.id = campaign_members.campaign_id 
      AND campaigns.owner_id = (SELECT auth.uid()::text)
    )
  );

-- Only service role can insert/update/delete members (we'll handle this in API)
CREATE POLICY "Service role can manage members" ON public.campaign_members
  FOR ALL USING (auth.role() = 'service_role');

-- Grant necessary permissions
GRANT ALL ON public.campaign_members TO service_role;
