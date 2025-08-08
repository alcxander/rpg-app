-- RESET (safe to re-run in Supabase SQL Editor)
DROP TRIGGER IF EXISTS users_updated_at_trigger ON public.users;
DROP TRIGGER IF EXISTS campaigns_updated_at_trigger ON public.campaigns;
DROP TRIGGER IF EXISTS sessions_updated_at_trigger ON public.sessions;
DROP TRIGGER IF EXISTS maps_updated_at_trigger ON public.maps;

DROP TABLE IF EXISTS public.loot_assignments CASCADE;
DROP TABLE IF EXISTS public.battles CASCADE;
DROP TABLE IF EXISTS public.maps CASCADE;
DROP TABLE IF EXISTS public.shops CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.campaigns CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Clerk user IDs are text like "user_123", not UUID. Use TEXT and compare JWT sub via auth.jwt().
CREATE TABLE public.users (
  id TEXT PRIMARY KEY,
  clerk_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('DM', 'Player')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.sessions (
  id TEXT PRIMARY KEY,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  active BOOLEAN DEFAULT TRUE,
  participants JSONB DEFAULT '[]'::jsonb, -- [{ userId: TEXT, role: 'DM'|'Player' }]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.maps (
  session_id TEXT PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  grid_size INTEGER NOT NULL DEFAULT 10,
  terrain_data JSONB DEFAULT '{}'::jsonb,
  tokens JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.battles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT REFERENCES public.sessions(id) ON DELETE CASCADE,
  map_ref TEXT REFERENCES public.maps(session_id) ON DELETE SET NULL,
  monsters JSONB DEFAULT '[]'::jsonb,
  allies JSONB DEFAULT '[]'::jsonb,
  log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  keeper JSONB DEFAULT '{}'::jsonb,
  inventory JSONB DEFAULT '[]'::jsonb,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.loot_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT REFERENCES public.sessions(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_data JSONB DEFAULT '{}'::jsonb,
  assigned_to_user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loot_assignments ENABLE ROW LEVEL SECURITY;

-- All policies compare to JWT subject from auth.jwt()->>'sub' (works for RS256 or HS256).
-- Users
CREATE POLICY "Users can view their own data." ON public.users
  FOR SELECT USING (id = (auth.jwt()->>'sub'));
CREATE POLICY "Users can insert their own data." ON public.users
  FOR INSERT WITH CHECK (id = (auth.jwt()->>'sub'));
CREATE POLICY "Users can update their own data." ON public.users
  FOR UPDATE USING (id = (auth.jwt()->>'sub')) WITH CHECK (id = (auth.jwt()->>'sub'));

-- Campaigns
CREATE POLICY "Campaign owners can manage their campaigns." ON public.campaigns
  FOR ALL USING (owner_id = (auth.jwt()->>'sub')) WITH CHECK (owner_id = (auth.jwt()->>'sub'));

-- Sessions
CREATE POLICY "Participants and owners can view sessions." ON public.sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = sessions.campaign_id AND c.owner_id = (auth.jwt()->>'sub'))
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(participants) p WHERE (p->>'userId') = (auth.jwt()->>'sub'))
  );
CREATE POLICY "Campaign owners can insert sessions." ON public.sessions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = sessions.campaign_id AND c.owner_id = (auth.jwt()->>'sub'))
  );
CREATE POLICY "Participants and owners can update sessions." ON public.sessions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = sessions.campaign_id AND c.owner_id = (auth.jwt()->>'sub'))
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(participants) p WHERE (p->>'userId') = (auth.jwt()->>'sub'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = sessions.campaign_id AND c.owner_id = (auth.jwt()->>'sub'))
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(participants) p WHERE (p->>'userId') = (auth.jwt()->>'sub'))
  );
CREATE POLICY "Campaign owners can delete sessions." ON public.sessions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = sessions.campaign_id AND c.owner_id = (auth.jwt()->>'sub'))
  );

-- Maps
CREATE POLICY "Participants can view maps." ON public.maps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = maps.session_id AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.participants) p WHERE (p->>'userId') = (auth.jwt()->>'sub')
      )
    )
  );
CREATE POLICY "DMs can manage maps (insert)." ON public.maps
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = maps.session_id AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.participants) p
        WHERE (p->>'userId') = (auth.jwt()->>'sub') AND p->>'role' = 'DM'
      )
    )
  );
CREATE POLICY "DMs can update maps." ON public.maps
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = maps.session_id AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.participants) p
        WHERE (p->>'userId') = (auth.jwt()->>'sub') AND p->>'role' = 'DM'
      )
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = maps.session_id AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.participants) p
        WHERE (p->>'userId') = (auth.jwt()->>'sub') AND p->>'role' = 'DM'
      )
    )
  );

-- Battles
CREATE POLICY "Participants can view battles." ON public.battles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = battles.session_id AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.participants) p WHERE (p->>'userId') = (auth.jwt()->>'sub')
      )
    )
  );
CREATE POLICY "DMs can insert battles." ON public.battles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = battles.session_id AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.participants) p
        WHERE (p->>'userId') = (auth.jwt()->>'sub') AND p->>'role' = 'DM'
      )
    )
  );

-- Shops
CREATE POLICY "Participants can view shops." ON public.shops
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = shops.campaign_id AND c.owner_id = (auth.jwt()->>'sub'))
    OR EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.campaign_id = shops.campaign_id AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.participants) p WHERE (p->>'userId') = (auth.jwt()->>'sub')
      )
    )
  );

-- Loot Assignments
CREATE POLICY "Participants can view loot assignments." ON public.loot_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = loot_assignments.session_id AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.participants) p WHERE (p->>'userId') = (auth.jwt()->>'sub')
      )
    )
  );

-- Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at_trigger BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER campaigns_updated_at_trigger BEFORE UPDATE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER sessions_updated_at_trigger BEFORE UPDATE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER maps_updated_at_trigger BEFORE UPDATE ON public.maps
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.maps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.battles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shops;
ALTER PUBLICATION supabase_realtime ADD TABLE public.loot_assignments;
