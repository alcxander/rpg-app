-- 006_players_gold_unique.sql
-- Ensure unique constraint exists for players_gold
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'players_gold_unique'
    ) THEN
        ALTER TABLE public.players_gold
        ADD CONSTRAINT players_gold_unique UNIQUE (player_id, campaign_id);
    END IF;
END $$;
