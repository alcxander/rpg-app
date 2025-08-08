-- Snapshot background per battle so you can switch between them later
ALTER TABLE public.battles
ADD COLUMN IF NOT EXISTS background_image TEXT;
