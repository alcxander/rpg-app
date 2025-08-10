-- Enable required extension for UUID generation
create extension if not exists pgcrypto;

-- Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'token_type') then
    create type token_type as enum ('shopkeeper', 'enemy', 'player');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'shop_type') then
    create type shop_type as enum ('potion', 'arcana', 'blacksmith', 'general', 'custom');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'rarity_type') then
    create type rarity_type as enum ('common', 'uncommon', 'rare', 'wondrous', 'legendary');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'shop_txn_type') then
    create type shop_txn_type as enum ('purchase', 'sell');
  end if;
end$$;

-- campaigns: add access_enabled if missing
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_name = 'campaigns' and column_name = 'access_enabled'
  ) then
    alter table public.campaigns add column access_enabled boolean not null default true;
  end if;
end$$;

-- tokens
create table if not exists public.tokens (
  id uuid primary key default gen_random_uuid(),
  type token_type not null,
  image_url text not null,
  description text,
  session_id uuid null,
  campaign_id uuid null,
  created_at timestamp with time zone not null default now(),
  constraint tokens_campaign_fk foreign key (campaign_id) references public.campaigns(id) on delete set null
);

create index if not exists idx_tokens_campaign on public.tokens(campaign_id);

-- shopkeepers
create table if not exists public.shopkeepers (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  race text,
  age int,
  alignment text,
  quote text,
  description text,
  shop_type shop_type not null,
  token_id uuid null references public.tokens(id) on delete set null,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_shopkeepers_campaign on public.shopkeepers(campaign_id);

-- shop_inventory
create table if not exists public.shop_inventory (
  id uuid primary key default gen_random_uuid(),
  shopkeeper_id uuid not null references public.shopkeepers(id) on delete cascade,
  item_name text not null,
  rarity rarity_type not null,
  base_price numeric(10,2) not null,
  price_adjustment_percent int not null,
  final_price numeric(10,2) not null,
  stock_quantity int not null default 0,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_shop_inventory_shopkeeper on public.shop_inventory(shopkeeper_id);

-- players_gold
create table if not exists public.players_gold (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  gold_amount numeric(10,2) not null default 0,
  updated_at timestamp with time zone not null default now(),
  unique (player_id, campaign_id)
);

create index if not exists idx_players_gold_campaign on public.players_gold(campaign_id);

-- shop_transactions
create table if not exists public.shop_transactions (
  id uuid primary key default gen_random_uuid(),
  shopkeeper_id uuid not null references public.shopkeepers(id) on delete cascade,
  player_id uuid not null,
  item_name text not null,
  quantity int not null,
  price_each numeric(10,2) not null,
  total_price numeric(10,2) not null,
  transaction_type shop_txn_type not null,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_shop_txn_shopkeeper on public.shop_transactions(shopkeeper_id);

-- Optional RLS (defense-in-depth); assumes authenticated JWTs used elsewhere.
-- You can refine with membership checks if you have a campaign_members table.

alter table public.tokens enable row level security;
alter table public.shopkeepers enable row level security;
alter table public.shop_inventory enable row level security;
alter table public.players_gold enable row level security;
alter table public.shop_transactions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'shopkeepers' and policyname = 'shopkeepers_read') then
    create policy shopkeepers_read on public.shopkeepers
      for select
      using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'shopkeepers' and policyname = 'shopkeepers_write') then
    create policy shopkeepers_write on public.shopkeepers
      for all
      using (true)
      with check (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'shop_inventory' and policyname = 'shop_inventory_read') then
    create policy shop_inventory_read on public.shop_inventory
      for select
      using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'shop_inventory' and policyname = 'shop_inventory_write') then
    create policy shop_inventory_write on public.shop_inventory
      for all
      using (true)
      with check (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'tokens' and policyname = 'tokens_read') then
    create policy tokens_read on public.tokens
      for select
      using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'tokens' and policyname = 'tokens_write') then
    create policy tokens_write on public.tokens
      for all
      using (true)
      with check (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'players_gold' and policyname = 'players_gold_read') then
    create policy players_gold_read on public.players_gold
      for select
      using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'players_gold' and policyname = 'players_gold_write') then
    create policy players_gold_write on public.players_gold
      for all
      using (true)
      with check (true);
  end if;

  if not exists (select 1 from pg_policies where tablename = 'shop_transactions' and policyname = 'shop_transactions_read') then
    create policy shop_transactions_read on public.shop_transactions
      for select
      using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'shop_transactions' and policyname = 'shop_transactions_write') then
    create policy shop_transactions_write on public.shop_transactions
      for all
      using (true)
      with check (true);
  end if;
end$$;
