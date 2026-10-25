import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BlockConfig } from '@shared/schema-types';
import { DIAGRAM_RENDER_OPTIONS } from '@shared/markdown/diagram-view';
import { BlockActionsProvider, type BlockActionsContextValue } from '@/components/PageBuilder/BlockActionsContext';
import { blockRegistry } from '@/components/PageBuilder/blocks';
import { DiagramSettings } from '@/components/PageBuilder/blocks/diagram/diagram-settings';
import { UpdateSettings } from '@/components/PageBuilder/blocks/update/update-settings';

// The browser draws diagrams with Pele's lazy build; a stub keeps this test about what the editor shows.
const renderAsync = vi.fn(async (source: string, _options: typeof DIAGRAM_RENDER_OPTIONS) => ({ svg: `<svg data-source="${source.length}"></svg>` }));
vi.mock('pele/lazy', () => ({
  renderAsync: (source: string, options: typeof DIAGRAM_RENDER_OPTIONS) => renderAsync(source, options),
}));

const stubActions: BlockActionsContextValue = {
  selectedBlockId: null,
  editingBlockId: null,
  hoveredBlockId: null,
  onSelect: () => {},
  onStartEditing: () => {},
  onStopEditing: () => {},
  onHoverBlock: () => {},
  onDuplicate: () => {},
  onDelete: () => {},
  hoverHighlight: null,
};

type StructuredData = Extract<NonNullable<BlockConfig["content"]>, { kind: "structured" }>["data"];
const diagramBlock = (data: StructuredData): BlockConfig => ({
  id: 'd1',
  name: 'docs/diagram',
  type: 'block',
  parentId: null,
  label: 'Diagram',
  category: 'docs',
  content: { kind: 'structured', data },
  styles: {},
  settings: {},
});

const updateBlock = (data: StructuredData): BlockConfig => ({
  id: 'u1',
  name: 'docs/update',
  type: 'container',
  parentId: null,
  label: 'Changelog entry',
  category: 'docs',
  content: { kind: 'structured', data },
  styles: {},
  settings: {},
  children: [],
});

describe('docs diagram in the editor', () => {
  it('shows the Mermaid code in a monospace box and the caption in a field', () => {
    render(<DiagramSettings block={diagramBlock({ code: 'flowchart LR\n  A --> B', caption: 'Flow' })} onUpdate={() => {}} />);
    const code = screen.getByLabelText('Mermaid code');
    expect(code.tagName).toBe('TEXTAREA');
    expect(code.className).toContain('font-mono');
    expect(code).toHaveValue('flowchart LR\n  A --> B');
    expect(screen.getByLabelText('Caption')).toHaveValue('Flow');
  });

  it('saves a change to the code and to the caption', () => {
    const onUpdate = vi.fn();
    render(<DiagramSettings block={diagramBlock({ code: 'flowchart LR', caption: '' })} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByLabelText('Mermaid code'), { target: { value: 'flowchart TD\n  X --> Y' } });
    expect(JSON.stringify(onUpdate.mock.calls.at(-1))).toContain('flowchart TD\\n  X --> Y');
    fireEvent.change(screen.getByLabelText('Caption'), { target: { value: 'Overview' } });
    expect(JSON.stringify(onUpdate.mock.calls.at(-1))).toContain('"caption":"Overview"');
  });

  it('draws the diagram on the canvas with the same view the page uses', async () => {
    const Component = blockRegistry['docs/diagram'].component as React.ComponentType<{ value: BlockConfig; onChange: (next: BlockConfig) => void; isPreview?: boolean }>;
    const { container } = render(
      <BlockActionsProvider value={stubActions}>
        <Component value={diagramBlock({ code: 'flowchart LR\n  A --> B', caption: 'Flow' })} onChange={() => {}} isPreview />
      </BlockActionsProvider>,
    );
    await waitFor(() => expect(container.querySelector('.np-diagram svg')).not.toBeNull());
    expect(renderAsync).toHaveBeenCalledWith('flowchart LR\n  A --> B', DIAGRAM_RENDER_OPTIONS);
    expect(screen.getByText('Flow')).toBeInTheDocument();
  });
});

describe('changelog entry in the editor', () => {
  it('edits the label and the description', () => {
    const onUpdate = vi.fn();
    render(<UpdateSettings block={updateBlock({ label: 'October 2026', description: '' })} onUpdate={onUpdate} />);
    expect(screen.getByLabelText('Label')).toHaveValue('October 2026');
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'v1.4.2' } });
    expect(JSON.stringify(onUpdate.mock.calls.at(-1))).toContain('"label":"v1.4.2"');
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Fixes' } });
    expect(JSON.stringify(onUpdate.mock.calls.at(-1))).toContain('"description":"Fixes"');
  });

  it('shows its label on the canvas, with the label beside the entry', () => {
    const Component = blockRegistry['docs/update'].component as React.ComponentType<{ value: BlockConfig; onChange: (next: BlockConfig) => void; isPreview?: boolean }>;
    const { container } = render(
      <BlockActionsProvider value={stubActions}>
        <Component value={updateBlock({ label: 'v1.4.2', description: 'Fixes' })} onChange={() => {}} isPreview />
      </BlockActionsProvider>,
    );
    expect(container.querySelector('.np-update__label')?.textContent).toContain('v1.4.2');
    expect(container.querySelector('.np-update__description')?.textContent).toBe('Fixes');
  });
});
