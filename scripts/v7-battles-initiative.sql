-- Initiative per battle (JSON keyed by combatant id to a number)
ALTER TABLE public.battles
ADD COLUMN IF NOT EXISTS initiative JSONB;
