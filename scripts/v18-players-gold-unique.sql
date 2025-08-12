-- Migration v18: Add unique constraint to players_gold

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

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_players_gold_player_campaign ON public.players_gold(player_id, campaign_id);
