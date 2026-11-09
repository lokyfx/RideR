ALTER TABLE delivery
    ADD COLUMN IF NOT EXISTS rider_dismissed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS restaurant_dismissed_at TIMESTAMPTZ;
