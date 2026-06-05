-- supabase/v0.7-contexts.sql
CREATE TABLE IF NOT EXISTS contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE nodes ADD COLUMN IF NOT EXISTS context_id UUID REFERENCES contexts(id);

GRANT ALL ON TABLE contexts TO authenticated;
GRANT ALL ON TABLE contexts TO service_role;

ALTER TABLE contexts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read contexts" ON contexts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage contexts" ON contexts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
