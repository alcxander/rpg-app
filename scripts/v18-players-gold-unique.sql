-- Migration: Ensure players_gold has unique constraint and proper structure
-- Add unique constraint for (player_id, campaign_id) to allow upserts

-- First, remove any duplicate records if they exist
DELETE FROM public.players_gold 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM public.players_gold 
  GROUP BY player_id, campaign_id
);

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'players_gold_unique' 
                 AND table_name = 'players_gold') THEN
    ALTER TABLE public.players_gold
      ADD CONSTRAINT players_gold_unique UNIQUE (player_id, campaign_id);
  END IF;
END $$;

-- Ensure proper indexes exist
CREATE INDEX IF NOT EXISTS idx_players_gold_player_id ON public.players_gold(player_id);
CREATE INDEX IF NOT EXISTS idx_players_gold_campaign_id ON public.players_gold(campaign_id);

-- Update RLS policies if needed
DROP POLICY IF EXISTS "Users can view their own gold" ON public.players_gold;
DROP POLICY IF EXISTS "Users can manage their own gold" ON public.players_gold;

CREATE POLICY "Users can view their own gold" ON public.players_gold
  FOR SELECT USING (player_id = auth.uid()::text);

CREATE POLICY "Campaign owners can view player gold" ON public.players_gold
  FOR SELECT USING (
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE owner_id = auth.uid()::text
    )
  );

CREATE POLICY "Campaign owners can manage player gold" ON public.players_gold
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE owner_id = auth.uid()::text
    )
  );

-- Grant permissions
GRANT ALL ON public.players_gold TO authenticated;
GRANT ALL ON public.players_gold TO service_role;
