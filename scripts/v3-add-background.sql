-- Add a background image column for maps
ALTER TABLE public.maps
ADD COLUMN IF NOT EXISTS background_image TEXT;

-- Optional: widen grid default if you want to enforce at DB-level (we keep logic in app)
-- ALTER TABLE public.maps ALTER COLUMN grid_size SET DEFAULT 20;
