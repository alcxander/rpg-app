-- Migration v18: Add unique constraints and indexes for players_gold

-- Add unique constraint to prevent duplicate gold records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'players_gold_unique'
  ) THEN
    ALTER TABLE public.players_gold
      ADD CONSTRAINT players_gold_unique UNIQUE (player_id, campaign_id);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_gold_player_id ON public.players_gold(player_id);
CREATE INDEX IF NOT EXISTS idx_players_gold_campaign_id ON public.players_gold(campaign_id);

-- Ensure RLS is enabled
ALTER TABLE public.players_gold ENABLE ROW LEVEL SECURITY;

-- Update RLS policies for players_gold
DROP POLICY IF EXISTS "Users can view their own gold" ON public.players_gold;
DROP POLICY IF EXISTS "Campaign owners can view all gold" ON public.players_gold;

CREATE POLICY "Users can view their own gold" ON public.players_gold
  FOR SELECT USING (player_id = (SELECT auth.uid()::text));

CREATE POLICY "Campaign owners can view and manage all gold in their campaigns" ON public.players_gold
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE owner_id = (SELECT auth.uid()::text)
    )
    OR
    player_id = (SELECT auth.uid()::text)
  );

-- Grant permissions
GRANT ALL ON public.players_gold TO authenticated;
GRANT ALL ON public.players_gold TO service_role;
