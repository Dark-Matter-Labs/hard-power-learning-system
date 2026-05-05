-- supabase/v0.9-newsletters.sql
-- Field Intelligence Newsletter tables
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS newsletters (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL CHECK (type IN ('mission_pathways', 'close_contacts')),
  content    TEXT NOT NULL,
  author_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletters_author ON newsletters(author_id);
CREATE INDEX IF NOT EXISTS idx_newsletters_author_type ON newsletters(author_id, type, created_at DESC);

ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own newsletters" ON newsletters
  FOR ALL USING (author_id = auth.uid());
