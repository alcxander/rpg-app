-- Add a UUID column while keeping current TEXT id as the display/name.
ALTER TABLE public.sessions
ADD COLUMN IF NOT EXISTS session_uuid UUID DEFAULT gen_random_uuid();

-- Enforce unique session "id" (name) per campaign.
CREATE UNIQUE INDEX IF NOT EXISTS sessions_campaign_id_id_unique
ON public.sessions (campaign_id, id);
