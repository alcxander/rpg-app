-- Create characters table
CREATE TABLE IF NOT EXISTS public.characters (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  campaign_id uuid,
  name text NOT NULL,
  race text,
  alignment text,
  class text,
  level integer DEFAULT 1,
  stats jsonb DEFAULT '{}'::jsonb,
  current_hp integer,
  max_hp integer,
  portrait_url text,
  notes text,
  gold numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT characters_pkey PRIMARY KEY (id),
  CONSTRAINT characters_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT characters_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id) ON DELETE SET NULL,
  CONSTRAINT characters_level_check CHECK (level > 0),
  CONSTRAINT characters_hp_check CHECK (current_hp >= 0 AND max_hp >= 0)
);

-- Create character_inventories table
CREATE TABLE IF NOT EXISTS public.character_inventories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL,
  item_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  item_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT character_inventories_pkey PRIMARY KEY (id),
  CONSTRAINT character_inventories_character_id_fkey FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE,
  CONSTRAINT character_inventories_quantity_check CHECK (quantity > 0)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_characters_user_id ON public.characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_campaign_id ON public.characters(campaign_id);
CREATE INDEX IF NOT EXISTS idx_character_inventories_character_id ON public.character_inventories(character_id);

-- Enable RLS
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_inventories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for characters
CREATE POLICY "Users can view their own characters" ON public.characters
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own characters" ON public.characters
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own characters" ON public.characters
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own characters" ON public.characters
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Campaign owners can view campaign characters" ON public.characters
  FOR SELECT USING (
    campaign_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.campaigns c 
      WHERE c.id = characters.campaign_id 
      AND c.owner_id = auth.uid()
    )
  );

-- RLS Policies for character_inventories
CREATE POLICY "Users can manage their character inventories" ON public.character_inventories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.characters c 
      WHERE c.id = character_inventories.character_id 
      AND c.user_id = auth.uid()
    )
  );

-- Grant permissions
GRANT ALL ON public.characters TO authenticated;
GRANT ALL ON public.characters TO service_role;
GRANT ALL ON public.character_inventories TO authenticated;
GRANT ALL ON public.character_inventories TO service_role;
