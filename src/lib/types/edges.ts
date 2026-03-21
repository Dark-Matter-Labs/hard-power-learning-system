export interface EdgeType {
  readonly id: string;
  readonly label: string;
  readonly description: string | null;
  readonly is_directional: boolean;
  readonly created_at: string;
}

export interface Edge {
  readonly id: string;
  readonly source_id: string;
  readonly target_id: string;
  readonly edge_type: string;
  readonly weight: number;
  readonly description: string | null;
  readonly author_id: string | null;
  readonly created_at: string;
}
