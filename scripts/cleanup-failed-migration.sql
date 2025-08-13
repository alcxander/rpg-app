-- Cleanup script for failed v14 migration
-- This will drop the campaign_members table and all dependent objects

-- Drop the table with CASCADE to remove dependent policies
DROP TABLE IF EXISTS public.campaign_members CASCADE;

-- Also clean up any orphaned policies that might remain
DO $$
BEGIN
    -- Drop policies that might reference campaign_members
    DROP POLICY IF EXISTS "Users can view their own characters" ON public.characters;
    DROP POLICY IF EXISTS "Session participants can view tokens" ON public.tokens;
    DROP POLICY IF EXISTS "Users can view campaign members for campaigns they belong to" ON public.campaign_members;
    DROP POLICY IF EXISTS "Campaign owners can manage members" ON public.campaign_members;
EXCEPTION
    WHEN undefined_object THEN
        -- Policy doesn't exist, that's fine
        NULL;
END $$;

-- Clean up any sequences or other objects
DROP SEQUENCE IF EXISTS campaign_members_id_seq CASCADE;
