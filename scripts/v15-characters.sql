-- 002_create_characters.sql
CREATE TABLE public.characters (
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

-- 003_character_inventory.sql
CREATE TABLE public.character_inventories (
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
CREATE POLICY "Users can view their own characters." ON public.characters
  FOR SELECT USING (
    user_id = (auth.jwt()->>'sub') OR
    EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = characters.campaign_id AND c.owner_id = (auth.jwt()->>'sub')) OR
    EXISTS (SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = characters.campaign_id AND cm.user_id = (auth.jwt()->>'sub'))
  );

CREATE POLICY "Users can manage their own characters." ON public.characters
  FOR ALL USING (user_id = (auth.jwt()->>'sub')) WITH CHECK (user_id = (auth.jwt()->>'sub'));

-- RLS Policies for character inventories
CREATE POLICY "Users can view inventories of accessible characters." ON public.character_inventories
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_inventories.character_id AND (
      c.user_id = (auth.jwt()->>'sub') OR
      EXISTS (SELECT 1 FROM public.campaigns camp WHERE camp.id = c.campaign_id AND camp.owner_id = (auth.jwt()->>'sub'))
    ))
  );

CREATE POLICY "Users can manage inventories of their characters." ON public.character_inventories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_inventories.character_id AND c.user_id = (auth.jwt()->>'sub'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.characters c WHERE c.id = character_inventories.character_id AND c.user_id = (auth.jwt()->>'sub'))
  );

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.characters;
ALTER PUBLICATION supabase_realtime ADD TABLE public.character_inventories;

-- Update trigger for characters
CREATE TRIGGER characters_updated_at_trigger BEFORE UPDATE ON public.characters
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
