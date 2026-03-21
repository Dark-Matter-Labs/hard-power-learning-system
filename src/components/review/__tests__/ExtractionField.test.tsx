import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExtractionField } from '../ExtractionField';

describe('ExtractionField', () => {
  it('renders field label and value', () => {
    render(
      <ExtractionField
        label="Summary"
        value="Test summary"
        onAction={vi.fn()}
      />
    );
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Test summary')).toBeInTheDocument();
  });

  it('calls onAction with accept', () => {
    const onAction = vi.fn();
    render(<ExtractionField label="Summary" value="Test" onAction={onAction} />);
    fireEvent.click(screen.getByLabelText('Accept'));
    expect(onAction).toHaveBeenCalledWith('accepted', 'Test');
  });

  it('calls onAction with reject', () => {
    const onAction = vi.fn();
    render(<ExtractionField label="Summary" value="Test" onAction={onAction} />);
    fireEvent.click(screen.getByLabelText('Reject'));
    expect(onAction).toHaveBeenCalledWith('rejected', 'Test');
  });

  it('enters edit mode and saves', () => {
    const onAction = vi.fn();
    render(<ExtractionField label="Summary" value="Original" onAction={onAction} />);
    fireEvent.click(screen.getByLabelText('Edit'));
    const input = screen.getByDisplayValue('Original');
    fireEvent.change(input, { target: { value: 'Edited' } });
    fireEvent.click(screen.getByLabelText('Save edit'));
    expect(onAction).toHaveBeenCalledWith('edited', 'Edited');
  });
});
