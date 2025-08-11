-- Add quantity column to shopkeeper_inventory table
ALTER TABLE shopkeeper_inventory 
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

-- Update existing records to have quantity = 1 if they don't have it
UPDATE shopkeeper_inventory 
SET quantity = 1 
WHERE quantity IS NULL;

-- Make quantity NOT NULL with default
ALTER TABLE shopkeeper_inventory 
ALTER COLUMN quantity SET NOT NULL,
ALTER COLUMN quantity SET DEFAULT 1;

-- Enable RLS on all tables for security
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopkeepers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopkeeper_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaigns (users can only access campaigns they own or have access to)
CREATE POLICY "Users can view their own campaigns" ON campaigns
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can create their own campaigns" ON campaigns
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own campaigns" ON campaigns
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own campaigns" ON campaigns
  FOR DELETE USING (owner_id = auth.uid());

-- RLS Policies for shopkeepers (users can access shopkeepers in campaigns they own or have access to)
CREATE POLICY "Users can view shopkeepers in accessible campaigns" ON shopkeepers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = shopkeepers.campaign_id 
      AND (campaigns.owner_id = auth.uid() OR campaigns.access_enabled = true)
    )
  );

CREATE POLICY "Campaign owners can manage shopkeepers" ON shopkeepers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = shopkeepers.campaign_id 
      AND campaigns.owner_id = auth.uid()
    )
  );

-- RLS Policies for shopkeeper_inventory (same access as shopkeepers)
CREATE POLICY "Users can view inventory in accessible campaigns" ON shopkeeper_inventory
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shopkeepers 
      JOIN campaigns ON campaigns.id = shopkeepers.campaign_id
      WHERE shopkeepers.id = shopkeeper_inventory.shopkeeper_id 
      AND (campaigns.owner_id = auth.uid() OR campaigns.access_enabled = true)
    )
  );

CREATE POLICY "Campaign owners can manage inventory" ON shopkeeper_inventory
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM shopkeepers 
      JOIN campaigns ON campaigns.id = shopkeepers.campaign_id
      WHERE shopkeepers.id = shopkeeper_inventory.shopkeeper_id 
      AND campaigns.owner_id = auth.uid()
    )
  );

-- RLS Policies for tokens (campaign owners only)
CREATE POLICY "Campaign owners can manage tokens" ON tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = tokens.campaign_id 
      AND campaigns.owner_id = auth.uid()
    )
  );
