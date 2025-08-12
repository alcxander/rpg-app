-- 015_create_characters.sql
CREATE TABLE IF NOT EXISTS public.characters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  campaign_id uuid, -- optional; character can be global or campaign-specific
  name text NOT NULL,
  race text,
  alignment text,
  class text,
  level integer DEFAULT 1,
  stats jsonb DEFAULT '{}'::jsonb, -- { str:int, dex:int, con:int, int:int, wis:int, cha:int }
  current_hp integer,
  max_hp integer,
  gold numeric DEFAULT 0, -- per-character gold
  portrait_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT characters_pkey PRIMARY KEY (id),
  CONSTRAINT characters_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT characters_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL
);

-- 016_character_inventory.sql
CREATE TABLE IF NOT EXISTS public.character_inventories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL,
  item_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  item_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT character_inventories_pkey PRIMARY KEY (id),
  CONSTRAINT character_inventories_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_inventories ENABLE ROW LEVEL SECURITY;

-- Characters policies
CREATE POLICY "Users can view their own characters" ON public.characters
  FOR SELECT USING (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can manage their own characters" ON public.characters
  FOR ALL USING (user_id = auth.jwt() ->> 'sub');

-- Campaign members can view characters in their campaigns
CREATE POLICY "Campaign members can view campaign characters" ON public.characters
  FOR SELECT USING (
    campaign_id IN (
      SELECT campaign_id FROM public.campaign_members 
      WHERE user_id = auth.jwt() ->> 'sub'
    )
  );

-- Character inventory policies
CREATE POLICY "Users can view their character inventories" ON public.character_inventories
  FOR SELECT USING (
    character_id IN (
      SELECT id FROM public.characters 
      WHERE user_id = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Users can manage their character inventories" ON public.character_inventories
  FOR ALL USING (
    character_id IN (
      SELECT id FROM public.characters 
      WHERE user_id = auth.jwt() ->> 'sub'
    )
  );
