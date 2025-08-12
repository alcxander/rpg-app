-- Migration: Ensure players_gold has unique constraint for proper upserts
-- This prevents duplicate gold records per player/campaign

-- Add unique constraint if it doesn't exist
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

-- Update the gold column name to be consistent
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players_gold' AND column_name = 'gold_amount') THEN
    ALTER TABLE public.players_gold RENAME COLUMN gold_amount TO gold;
  END IF;
EXCEPTION
  WHEN undefined_column THEN
    -- Column doesn't exist, that's fine
    NULL;
END $$;

-- Ensure gold column exists with proper type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players_gold' AND column_name = 'gold') THEN
    ALTER TABLE public.players_gold ADD COLUMN gold numeric DEFAULT 0;
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_players_gold_player_campaign ON public.players_gold(player_id, campaign_id);
