-- Migration: Add token ownership and control columns
-- First check if columns exist before adding them
DO $$ 
BEGIN
    -- Add owner_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tokens' AND column_name = 'owner_id') THEN
        ALTER TABLE public.tokens ADD COLUMN owner_id text NULL;
    END IF;
    
    -- Add controlled_by_character_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tokens' AND column_name = 'controlled_by_character_id') THEN
        ALTER TABLE public.tokens ADD COLUMN controlled_by_character_id uuid NULL;
    END IF;
    
    -- Add is_locked column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tokens' AND column_name = 'is_locked') THEN
        ALTER TABLE public.tokens ADD COLUMN is_locked boolean NOT NULL DEFAULT false;
    END IF;
END $$;

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
    -- Add owner_id foreign key constraint
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'tokens_owner_id_fkey') THEN
        ALTER TABLE public.tokens 
        ADD CONSTRAINT tokens_owner_id_fkey 
        FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
    
    -- Add character foreign key constraint
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'tokens_controlled_by_character_id_fkey') THEN
        ALTER TABLE public.tokens 
        ADD CONSTRAINT tokens_controlled_by_character_id_fkey 
        FOREIGN KEY (controlled_by_character_id) REFERENCES public.characters(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tokens_owner_id ON public.tokens(owner_id);
CREATE INDEX IF NOT EXISTS idx_tokens_controlled_by_character_id ON public.tokens(controlled_by_character_id);
