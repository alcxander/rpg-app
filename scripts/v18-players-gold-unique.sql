-- Add unique constraint to players_gold if it doesn't exist
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

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_players_gold_player_campaign ON public.players_gold(player_id, campaign_id);

-- Update RLS policies
DROP POLICY IF EXISTS "Users can view their own gold" ON public.players_gold;
DROP POLICY IF EXISTS "Users can manage their own gold" ON public.players_gold;

CREATE POLICY "Users can view their own gold" ON public.players_gold
  FOR SELECT USING (player_id = auth.uid());

CREATE POLICY "Campaign owners can view all player gold in their campaigns" ON public.players_gold
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = players_gold.campaign_id
      AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Campaign owners can manage player gold in their campaigns" ON public.players_gold
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = players_gold.campaign_id
      AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own gold" ON public.players_gold
  FOR ALL USING (player_id = auth.uid());
