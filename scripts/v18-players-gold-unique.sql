-- 019_players_gold_unique.sql
-- Ensure unique constraint exists for players_gold
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                 WHERE constraint_name = 'players_gold_unique') THEN
    ALTER TABLE public.players_gold
      ADD CONSTRAINT players_gold_unique UNIQUE (player_id, campaign_id);
  END IF;
END $$;
