-- Add thumbnail_url for conversation list preview (first page of compiled PDF)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS thumbnail_url TEXT DEFAULT NULL;

COMMENT ON COLUMN conversations.thumbnail_url IS 'URL path to first-page PDF thumbnail image, e.g. /api/thumbnails/{id}';
