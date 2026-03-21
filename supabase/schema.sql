-- Configurable taxonomy
CREATE TABLE node_types (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  color TEXT,
  icon TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE edge_types (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  is_directional BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Core nodes table
CREATE TABLE nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type TEXT NOT NULL REFERENCES node_types(id),
  title TEXT NOT NULL,
  description TEXT,
  content JSONB DEFAULT NULL,
  hunch_type TEXT CHECK (hunch_type IN ('new', 'feedback', 'test_result', 'external_validation')),
  confidence_level INT CHECK (confidence_level BETWEEN 1 AND 5),
  confidence_basis TEXT CHECK (confidence_basis IN ('intuition', 'analogy', 'observation', 'early_evidence', 'strong_evidence')),
  status TEXT DEFAULT 'raw' CHECK (status IN ('raw', 'processing', 'llm_reviewed', 'human_reviewed', 'promoted', 'error', 'archived', 'falsified', 'suspended')),
  llm_extraction JSONB,
  llm_review JSONB,
  human_review JSONB,
  author_id UUID REFERENCES auth.users(id),
  parent_node_id UUID REFERENCES nodes(id),
  domain_tags TEXT[] DEFAULT '{}',
  external_links JSONB DEFAULT '[]',
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Edges between nodes
CREATE TABLE edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL REFERENCES edge_types(id),
  weight FLOAT DEFAULT 1.0,
  description TEXT,
  author_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, target_id, edge_type)
);

-- Assets (v2)
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  medium TEXT NOT NULL,
  content TEXT,
  source_node_ids UUID[] DEFAULT '{}',
  llm_annotations JSONB,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'human_reviewed', 'published')),
  author_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_node_id UUID REFERENCES nodes(id),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_nodes_type ON nodes(node_type);
CREATE INDEX idx_nodes_status ON nodes(status);
CREATE INDEX idx_nodes_author ON nodes(author_id);
CREATE INDEX idx_nodes_domain_tags ON nodes USING GIN(domain_tags);
CREATE INDEX idx_edges_source ON edges(source_id);
CREATE INDEX idx_edges_target ON edges(target_id);
CREATE INDEX idx_activity_created ON activity_log(created_at DESC);

-- RLS policies (permissive for authenticated users)
ALTER TABLE node_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE edge_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read node_types" ON node_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage node_types" ON node_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read edge_types" ON edge_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage edge_types" ON edge_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read nodes" ON nodes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage nodes" ON nodes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read edges" ON edges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage edges" ON edges FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read assets" ON assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage assets" ON assets FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read activity_log" ON activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage activity_log" ON activity_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE edges;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER nodes_updated_at
  BEFORE UPDATE ON nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
