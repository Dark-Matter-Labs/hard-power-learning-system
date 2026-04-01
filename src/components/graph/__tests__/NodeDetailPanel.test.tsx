import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NodeDetailPanel } from '../NodeDetailPanel';
import type { Node } from '@/lib/types/nodes';
import type { Edge } from '@/lib/types/edges';

function makeNode(overrides: Partial<Node>): Node {
  return {
    id: 'node-1',
    node_type: 'hunch',
    title: 'Test node title',
    description: null,
    content: null,
    hunch_type: null,
    confidence_level: null,
    confidence_basis: null,
    status: 'raw',
    llm_extraction: null,
    llm_review: null,
    human_review: null,
    author_id: null,
    parent_node_id: null,
    insight_date: null,
    domain_tags: [],
    external_links: [],
    attachments: [],
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeEdge(overrides: Partial<Edge>): Edge {
  return {
    id: 'edge-1',
    source_id: '',
    target_id: '',
    edge_type: '',
    weight: 1,
    description: null,
    author_id: null,
    created_at: '',
    ...overrides,
  };
}

const testNode = makeNode({
  id: 'node-abc',
  node_type: 'hunch',
  title: 'My hunch title',
  description: 'A detailed description',
  status: 'promoted',
  domain_tags: ['climate', 'policy'],
});

describe('NodeDetailPanel — view mode', () => {
  it('renders title in view mode', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText('My hunch title')).toBeInTheDocument();
  });

  it('renders Edit button in view mode', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('renders connections section when edges exist', () => {
    const otherNode = makeNode({ id: 'other-1', title: 'Other node' });
    const edge = makeEdge({ source_id: 'node-abc', target_id: 'other-1', edge_type: 'related_to' });
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[edge]}
        allNodes={[testNode, otherNode]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/Connections/)).toBeInTheDocument();
  });
});

describe('NodeDetailPanel — edit mode toggle', () => {
  it('clicking Edit switches to edit mode showing title input', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const titleInput = screen.getByDisplayValue('My hunch title');
    expect(titleInput.tagName).toBe('INPUT');
  });

  it('edit mode shows description textarea', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByDisplayValue('A detailed description')).toBeInTheDocument();
  });

  it('edit mode shows type select', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByRole('combobox', { name: /type/i })).toBeInTheDocument();
  });

  it('edit mode shows domain tag chips', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByText('climate')).toBeInTheDocument();
    expect(screen.getByText('policy')).toBeInTheDocument();
  });

  it('edit mode shows Save and Cancel buttons', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });
});

describe('NodeDetailPanel — Cancel', () => {
  it('Cancel returns to view mode without calling fetch', () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    fetchSpy.mockRestore();
  });

  it('Cancel discards field changes', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const titleInput = screen.getByDisplayValue('My hunch title');
    fireEvent.change(titleInput, { target: { value: 'Changed title' } });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    // Back in view mode — original title shown
    expect(screen.getByText('My hunch title')).toBeInTheDocument();
  });
});

describe('NodeDetailPanel — Save', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: { ...testNode, title: 'Updated title' } }),
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Save calls fetch PATCH with updated fields', async () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const titleInput = screen.getByDisplayValue('My hunch title');
    fireEvent.change(titleInput, { target: { value: 'Updated title' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/nodes/node-abc'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });

  it('Save exits edit mode on success', async () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });
  });

  it('Save calls onNodeUpdated with updated node', async () => {
    const onNodeUpdated = vi.fn();
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
        onNodeUpdated={onNodeUpdated}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(onNodeUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Updated title' })
      );
    });
  });
});

describe('NodeDetailPanel — status select constraints', () => {
  it('status select only shows user-facing statuses', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const statusSelect = screen.getByRole('combobox', { name: /status/i });
    const options = Array.from(statusSelect.querySelectorAll('option')).map(o => o.value);
    expect(options).toContain('promoted');
    expect(options).toContain('archived');
    expect(options).toContain('falsified');
    expect(options).toContain('suspended');
    expect(options).not.toContain('raw');
    expect(options).not.toContain('processing');
    expect(options).not.toContain('llm_reviewed');
    expect(options).not.toContain('human_reviewed');
    expect(options).not.toContain('error');
  });
});

describe('NodeDetailPanel — domain tag chips', () => {
  it('renders removable tag chips in edit mode', () => {
    render(
      <NodeDetailPanel
        node={testNode}
        edges={[]}
        allNodes={[testNode]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    // Each chip should have a remove button
    const removeButtons = screen.getAllByRole('button', { name: /remove.*tag|×/i });
    expect(removeButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('adding a tag via input and Enter appends it to chips', () => {
    const nodeWithTags = makeNode({ ...testNode, domain_tags: ['existing'] });
    render(
      <NodeDetailPanel
        node={nodeWithTags}
        edges={[]}
        allNodes={[nodeWithTags]}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const tagInput = screen.getByPlaceholderText(/add tag/i);
    fireEvent.change(tagInput, { target: { value: 'newtag' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });
    expect(screen.getByText('newtag')).toBeInTheDocument();
  });
});
