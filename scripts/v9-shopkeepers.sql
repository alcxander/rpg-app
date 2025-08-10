-- v9: Shopkeepers, Inventory, Tokens, Players Gold, Transactions, Campaign Access Toggle

-- Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_type') THEN
    CREATE TYPE shop_type AS ENUM ('potion', 'arcana', 'blacksmith', 'general', 'custom');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_rarity') THEN
    CREATE TYPE item_rarity AS ENUM ('common', 'uncommon', 'rare', 'wondrous', 'legendary');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'token_type') THEN
    CREATE TYPE token_type AS ENUM ('shopkeeper', 'enemy', 'player');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_tx_type') THEN
    CREATE TYPE shop_tx_type AS ENUM ('purchase', 'sell');
  END IF;
END $$;

-- Campaigns: add access_enabled (player access to shops)
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS access_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Tokens (reusable for future)
CREATE TABLE IF NOT EXISTS public.tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type token_type NOT NULL,
  image_url TEXT NOT NULL,
  description TEXT,
  session_id TEXT NULL REFERENCES public.sessions(id) ON DELETE SET NULL,
  campaign_id UUID NULL REFERENCES public.campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shopkeepers
CREATE TABLE IF NOT EXISTS public.shopkeepers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  race TEXT,
  age INTEGER,
  alignment TEXT,
  quote TEXT,
  description TEXT,
  shop_type shop_type NOT NULL,
  token_id UUID NULL REFERENCES public.tokens(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inventory
CREATE TABLE IF NOT EXISTS public.shop_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopkeeper_id UUID NOT NULL REFERENCES public.shopkeepers(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  rarity item_rarity NOT NULL,
  base_price NUMERIC(10,2) NOT NULL,
  price_adjustment_percent INTEGER NOT NULL DEFAULT 0, -- -5..+5 applied at generation
  final_price NUMERIC(10,2) NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Players Gold per campaign
CREATE TABLE IF NOT EXISTS public.players_gold (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  gold_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, campaign_id)
);

-- Shop transactions
CREATE TABLE IF NOT EXISTS public.shop_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopkeeper_id UUID NOT NULL REFERENCES public.shopkeepers(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price_each NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  transaction_type shop_tx_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopkeepers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players_gold ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_transactions ENABLE ROW LEVEL SECURITY;

-- Helper: is campaign owner
CREATE OR REPLACE FUNCTION public.is_campaign_owner(c_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = c_id AND c.owner_id = (auth.jwt()->>'sub')
  );
$$ LANGUAGE sql STABLE;

-- Helper: is participant in any session for campaign
CREATE OR REPLACE FUNCTION public.is_campaign_participant(c_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sessions s
    WHERE s.campaign_id = c_id
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.participants) p
        WHERE (p->>'userId') = (auth.jwt()->>'sub')
      )
  );
$$ LANGUAGE sql STABLE;

-- Tokens policies
DROP POLICY IF EXISTS "Tokens select in campaign or session membership" ON public.tokens;
CREATE POLICY "Tokens select in campaign or session membership" ON public.tokens
  FOR SELECT USING (
    (campaign_id IS NULL OR public.is_campaign_owner(campaign_id) OR public.is_campaign_participant(campaign_id))
  );

DROP POLICY IF EXISTS "Tokens insert by campaign owner" ON public.tokens;
CREATE POLICY "Tokens insert by campaign owner" ON public.tokens
  FOR INSERT WITH CHECK (
    campaign_id IS NULL OR public.is_campaign_owner(campaign_id)
  );

DROP POLICY IF EXISTS "Tokens update by campaign owner" ON public.tokens;
CREATE POLICY "Tokens update by campaign owner" ON public.tokens
  FOR UPDATE USING (campaign_id IS NULL OR public.is_campaign_owner(campaign_id))
  WITH CHECK (campaign_id IS NULL OR public.is_campaign_owner(campaign_id));

-- Shopkeepers policies
DROP POLICY IF EXISTS "Shopkeepers select for campaign members or owner" ON public.shopkeepers;
CREATE POLICY "Shopkeepers select for campaign members or owner" ON public.shopkeepers
  FOR SELECT USING (
    public.is_campaign_owner(campaign_id) OR public.is_campaign_participant(campaign_id)
  );

DROP POLICY IF EXISTS "Shopkeepers insert by owner" ON public.shopkeepers;
CREATE POLICY "Shopkeepers insert by owner" ON public.shopkeepers
  FOR INSERT WITH CHECK (public.is_campaign_owner(campaign_id));

DROP POLICY IF EXISTS "Shopkeepers update by owner" ON public.shopkeepers;
CREATE POLICY "Shopkeepers update by owner" ON public.shopkeepers
  FOR UPDATE USING (public.is_campaign_owner(campaign_id))
  WITH CHECK (public.is_campaign_owner(campaign_id));

-- Inventory policies
DROP POLICY IF EXISTS "Inventory select for campaign members or owner" ON public.shop_inventory;
CREATE POLICY "Inventory select for campaign members or owner" ON public.shop_inventory
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.shopkeepers sk WHERE sk.id = shop_inventory.shopkeeper_id
      AND (public.is_campaign_owner(sk.campaign_id) OR public.is_campaign_participant(sk.campaign_id)))
  );

DROP POLICY IF EXISTS "Inventory manage by owner" ON public.shop_inventory;
CREATE POLICY "Inventory manage by owner" ON public.shop_inventory
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.shopkeepers sk WHERE sk.id = shop_inventory.shopkeeper_id
      AND public.is_campaign_owner(sk.campaign_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.shopkeepers sk WHERE sk.id = shop_inventory.shopkeeper_id
      AND public.is_campaign_owner(sk.campaign_id))
  );

-- Players gold policies: owner can view/edit all in campaign; players can view their own row
DROP POLICY IF EXISTS "PlayersGold select by owner or self" ON public.players_gold;
CREATE POLICY "PlayersGold select by owner or self" ON public.players_gold
  FOR SELECT USING (
    player_id = (auth.jwt()->>'sub') OR public.is_campaign_owner(campaign_id)
  );

DROP POLICY IF EXISTS "PlayersGold upsert by owner or self" ON public.players_gold;
CREATE POLICY "PlayersGold upsert by owner or self" ON public.players_gold
  FOR INSERT WITH CHECK (
    player_id = (auth.jwt()->>'sub') OR public.is_campaign_owner(campaign_id)
  );
CREATE POLICY "PlayersGold update by owner or self" ON public.players_gold
  FOR UPDATE USING (
    player_id = (auth.jwt()->>'sub') OR public.is_campaign_owner(campaign_id)
  ) WITH CHECK (
    player_id = (auth.jwt()->>'sub') OR public.is_campaign_owner(campaign_id)
  );

-- Transactions policies: readable by campaign members; insert via server
DROP POLICY IF EXISTS "ShopTx select for members" ON public.shop_transactions;
CREATE POLICY "ShopTx select for members" ON public.shop_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shopkeepers sk
      WHERE sk.id = shop_transactions.shopkeeper_id
        AND (public.is_campaign_owner(sk.campaign_id) OR public.is_campaign_participant(sk.campaign_id))
    )
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tokens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopkeepers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players_gold;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_transactions;
