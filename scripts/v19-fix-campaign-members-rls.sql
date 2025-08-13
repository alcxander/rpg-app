-- Fix infinite recursion in campaign_members RLS policies
-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view campaign members for campaigns they own or are members of" ON campaign_members;
DROP POLICY IF EXISTS "Campaign owners can manage members" ON campaign_members;
DROP POLICY IF EXISTS "Users can view their own membership" ON campaign_members;

-- Create simpler policies that don't cause recursion
CREATE POLICY "Users can view campaign members" ON campaign_members
  FOR SELECT
  USING (
    -- User is the campaign owner (direct check without recursion)
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_members.campaign_id 
      AND campaigns.owner_id = auth.uid()::text
    )
    OR
    -- User is a member of the campaign
    user_id = auth.uid()::text
  );

CREATE POLICY "Campaign owners can insert members" ON campaign_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_members.campaign_id 
      AND campaigns.owner_id = auth.uid()::text
    )
  );

CREATE POLICY "Campaign owners can update members" ON campaign_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_members.campaign_id 
      AND campaigns.owner_id = auth.uid()::text
    )
  );

CREATE POLICY "Campaign owners can delete members" ON campaign_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_members.campaign_id 
      AND campaigns.owner_id = auth.uid()::text
    )
  );
