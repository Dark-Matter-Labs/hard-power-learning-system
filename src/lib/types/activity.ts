export type ActivityAction =
  | 'created_hunch'
  | 'reviewed'
  | 'promoted'
  | 'connected'
  | 'challenged'
  | 'archived'
  | 'created_asset';

export interface ActivityLogEntry {
  readonly id: string;
  readonly actor_id: string | null;
  readonly action: ActivityAction;
  readonly target_node_id: string | null;
  readonly details: Record<string, unknown>;
  readonly created_at: string;
}
