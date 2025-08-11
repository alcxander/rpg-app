-- Add image_url column to shopkeepers table
-- This column will store the generated profile image for each shopkeeper

ALTER TABLE shopkeepers 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN shopkeepers.image_url IS 'URL or data URI for the shopkeeper profile image, generated via Stability AI or fallback';
