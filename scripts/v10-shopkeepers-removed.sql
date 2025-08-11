-- Add soft-delete flags to shopkeepers so DMs can remove without data loss
ALTER TABLE shopkeepers
ADD COLUMN IF NOT EXISTS removed boolean NOT NULL DEFAULT false;

ALTER TABLE shopkeepers
ADD COLUMN IF NOT EXISTS removed_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_shopkeepers_campaign_removed ON shopkeepers (campaign_id, removed);
