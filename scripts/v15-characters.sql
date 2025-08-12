-- Migration: Add characters and character_inventories tables
-- This enables per-character data storage and inventory management

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
  gold numeric DEFAULT 0, -- per-character gold tracking
  portrait_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT characters_pkey PRIMARY KEY (id),
  CONSTRAINT characters_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT characters_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL
);

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

-- RLS Policies for characters
CREATE POLICY "Users can view their own characters" ON public.characters
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can view characters in campaigns they belong to" ON public.characters
  FOR SELECT USING (
    campaign_id IN (
      SELECT campaign_id FROM public.campaign_members WHERE user_id = auth.uid()
    ) OR
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own characters" ON public.characters
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own characters" ON public.characters
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Campaign owners can update characters in their campaigns" ON public.characters
  FOR UPDATE USING (
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE owner_id = auth.uid()
    )
  );

-- RLS Policies for character_inventories
CREATE POLICY "Users can view inventories of their characters" ON public.character_inventories
  FOR SELECT USING (
    character_id IN (
      SELECT id FROM public.characters WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Campaign owners can view character inventories" ON public.character_inventories
  FOR SELECT USING (
    character_id IN (
      SELECT id FROM public.characters WHERE campaign_id IN (
        SELECT id FROM public.campaigns WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage inventories of their characters" ON public.character_inventories
  FOR ALL USING (
    character_id IN (
      SELECT id FROM public.characters WHERE user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_characters_user_id ON public.characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_campaign_id ON public.characters(campaign_id);
CREATE INDEX IF NOT EXISTS idx_character_inventories_character_id ON public.character_inventories(character_id);
