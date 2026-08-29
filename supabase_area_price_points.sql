-- ============================================================
-- AssetX Estate - Area Price Points Migration
-- Purpose: add an internal comparable price-point table for point-level valuation.
-- Run in Supabase Dashboard -> SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS area_price_points (
  id                          SERIAL PRIMARY KEY,
  valuation_id                INT REFERENCES valuations(id) ON DELETE SET NULL,
  source_type                 TEXT DEFAULT 'manual_comp',
  province                    TEXT DEFAULT '',
  district                    TEXT DEFAULT '',
  subdistrict                 TEXT DEFAULT '',
  lat                         NUMERIC,
  lng                         NUMERIC,
  radius_m                    NUMERIC DEFAULT 1000,
  property_type               TEXT DEFAULT '',
  property_subtype            TEXT DEFAULT '',
  land_area_sqw               NUMERIC DEFAULT 0,
  price_per_sqw               NUMERIC DEFAULT 0,
  total_price                 NUMERIC DEFAULT 0,
  transaction_or_listing_date DATE,
  source_url                  TEXT DEFAULT '',
  source_note                 TEXT DEFAULT '',
  confidence_score            NUMERIC DEFAULT 60,
  verified_by                 TEXT DEFAULT '',
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS area_price_points_location_idx
  ON area_price_points (province, district, subdistrict, property_type);

CREATE INDEX IF NOT EXISTS area_price_points_lat_lng_idx
  ON area_price_points (lat, lng);

ALTER TABLE area_price_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all" ON area_price_points;
CREATE POLICY "allow_all" ON area_price_points
  FOR ALL USING (true) WITH CHECK (true);
