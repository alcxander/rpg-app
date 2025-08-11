-- Add soft-delete fields to shopkeepers and ensure defaults.
ALTER TABLE public.shopkeepers
ADD COLUMN IF NOT EXISTS removed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;

-- Optional helpful index
CREATE INDEX IF NOT EXISTS idx_shopkeepers_campaign_active
ON public.shopkeepers (campaign_id, removed);
