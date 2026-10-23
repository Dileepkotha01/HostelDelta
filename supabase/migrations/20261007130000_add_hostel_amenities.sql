ALTER TABLE hostels 
ADD COLUMN IF NOT EXISTS amenities jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS food_details text;
