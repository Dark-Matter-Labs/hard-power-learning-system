INSERT INTO node_types (id, label, description, color, sort_order) VALUES
  ('hunch', 'Hunch', 'A directional belief about how the world works', '#7F77DD', 1),
  ('assumption_background', 'Background Assumption', 'Contextual given — not directly testable, but challengeable', '#1D9E75', 2),
  ('assumption_foreground', 'Foreground Assumption', 'Testable if/then proposition derived from a hunch', '#D85A30', 3),
  ('test', 'Test', 'A specific action to validate or challenge an assumption', '#D4537E', 4),
  ('learning', 'Learning', 'What was learned from a test — may spawn new hunches', '#378ADD', 5),
  ('option', 'Option', 'A COF investment option or strategic bet', '#BA7517', 6),
  ('person', 'Person', 'An individual in the network', '#888780', 7),
  ('organisation', 'Organisation', 'An organisation, fund, or institution', '#888780', 8),
  ('site', 'Site', 'A geographical site or context', '#639922', 9);

INSERT INTO edge_types (id, label, is_directional) VALUES
  ('supports', 'Supports', true),
  ('contradicts', 'Contradicts', true),
  ('requires', 'Requires', true),
  ('evolved_from', 'Evolved from', true),
  ('tested_by', 'Tested by', true),
  ('produced', 'Produced', true),
  ('connected_to', 'Connected to', false),
  ('works_at', 'Works at', true),
  ('authored_by', 'Authored by', true),
  ('challenges', 'Challenges', true);
