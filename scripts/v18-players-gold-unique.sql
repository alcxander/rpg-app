-- Migration v18: Add unique constraints and cleanup for players_gold table

-- First, remove any duplicate records in players_gold table
DELETE FROM public.players_gold 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM public.players_gold 
  GROUP BY player_id, campaign_id
);

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'players_gold_unique'
    AND table_name = 'players_gold'
  ) THEN
    ALTER TABLE public.players_gold
      ADD CONSTRAINT players_gold_unique UNIQUE (player_id, campaign_id);
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_players_gold_player_id ON public.players_gold(player_id);
CREATE INDEX IF NOT EXISTS idx_players_gold_campaign_id ON public.players_gold(campaign_id);

-- Ensure RLS is enabled
ALTER TABLE public.players_gold ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own gold" ON public.players_gold;
DROP POLICY IF EXISTS "Campaign owners can manage player gold" ON public.players_gold;

-- RLS Policies
CREATE POLICY "Users can view their own gold" ON public.players_gold
  FOR SELECT USING (
    player_id = (SELECT auth.uid()::text)
    OR
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE created_by = (SELECT auth.uid()::text)
    )
  );

CREATE POLICY "Campaign owners can manage player gold" ON public.players_gold
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE created_by = (SELECT auth.uid()::text)
    )
  );

-- Grant permissions
GRANT ALL ON public.players_gold TO authenticated;
GRANT ALL ON public.players_gold TO service_role;
