-- AssetX Marketing OS workspace persistence
-- Run this in Supabase SQL editor before enabling cloud sync on /marketing.

CREATE TABLE IF NOT EXISTS marketing_workspaces (
  id          TEXT PRIMARY KEY DEFAULT 'default',
  payload     JSONB NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE marketing_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all" ON marketing_workspaces
  FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION set_marketing_workspaces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS marketing_workspaces_updated_at ON marketing_workspaces;
CREATE TRIGGER marketing_workspaces_updated_at
BEFORE UPDATE ON marketing_workspaces
FOR EACH ROW
EXECUTE FUNCTION set_marketing_workspaces_updated_at();
