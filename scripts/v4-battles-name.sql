-- Add name and slug for battles
ALTER TABLE public.battles
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS slug TEXT;

-- Optional simple index for quick lookup by slug
CREATE INDEX IF NOT EXISTS battles_slug_idx ON public.battles (slug);
