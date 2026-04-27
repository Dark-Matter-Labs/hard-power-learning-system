-- supabase/v0.8-lifecycle.sql
-- Hunch lifecycle tracking
-- Run in Supabase SQL Editor

-- Lifecycle stage on nodes
ALTER TABLE nodes
  ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT
    DEFAULT 'divergence'
    CHECK (lifecycle_stage IN ('divergence', 'attractor', 'convergence', 'execution', 'archived'));

ALTER TABLE nodes
  ADD COLUMN IF NOT EXISTS stage_transitioned_at TIMESTAMPTZ;

ALTER TABLE nodes
  ADD COLUMN IF NOT EXISTS stage_transition_reason TEXT;

-- Backfill: set existing archived/falsified/suspended nodes to 'archived' stage
UPDATE nodes
  SET lifecycle_stage = 'archived'
  WHERE status IN ('archived', 'falsified', 'suspended')
    AND lifecycle_stage = 'divergence';

-- Edge path_status for reinforcement tracking
ALTER TABLE edges
  ADD COLUMN IF NOT EXISTS path_status TEXT
    DEFAULT 'active'
    CHECK (path_status IN ('active', 'reinforced', 'weakened', 'broken'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nodes_lifecycle_stage ON nodes(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_edges_path_status ON edges(path_status);
