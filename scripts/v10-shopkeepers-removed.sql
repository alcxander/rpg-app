-- Add soft-delete columns to shopkeepers table if missing
alter table shopkeepers
  add column if not exists removed boolean not null default false,
  add column if not exists removed_at timestamptz null;

-- Optional index to speed campaign listing of active shopkeepers
create index if not exists shopkeepers_campaign_active_idx
  on shopkeepers (campaign_id, removed);
