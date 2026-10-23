import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BlockConfig } from '@shared/schema-types';
// Load the renderer entry first: the renderer modules import each other through the block table.
import { getBlockComponent } from '../../../renderer/react/render-helpers';
import { createDefaultBlock } from '@shared/block-catalog';
import { STEPS_CSS } from '@shared/blocks/steps-css';
import { BlockActionsProvider, type BlockActionsContextValue } from '@/components/PageBuilder/BlockActionsContext';
import { blockRegistry } from '@/components/PageBuilder/blocks';
import { StepsSettings } from '@/components/PageBuilder/blocks/steps/steps-settings';
import { StepSettings } from '@/components/PageBuilder/blocks/steps/step-settings';

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

const makeSteps = (data?: Record<string, string>): BlockConfig => {
  let n = 0;
  const block = createDefaultBlock({ name: 'core/steps', id: 'steps', newId: () => `c${++n}` });
  if (!block) throw new Error('core/steps missing from the catalog');
  return data ? { ...block, content: { kind: 'structured', data } } : block;
};

const renderPublished = (block: BlockConfig): string => {
  const Component = getBlockComponent(block.name);
  if (!Component) throw new Error(`No published renderer for ${block.name}`);
  return renderToStaticMarkup(<Component {...block} />);
};

describe('Steps published view', () => {
  it('renders an ordered list of step items with titles and bodies', () => {
    const html = renderPublished(makeSteps());
    expect(html).toContain('class="wp-block-steps np-steps--vertical np-steps--number ');
    expect(html).toContain('<ol class="np-steps__items">');
    expect(html.match(/<li class="wp-block-step /g)).toHaveLength(3);
    expect(html).toContain('<h3 class="np-step__title">First step</h3>');
    expect(html).toContain('<div class="np-step__body">');
    expect(html).toContain('Explain what to do in this step.');
  });

  it('puts the layout and marker in the classes', () => {
    const html = renderPublished(makeSteps({ layout: 'horizontal', marker: 'dot' }));
    expect(html).toContain('np-steps--horizontal np-steps--dot');
  });

  it('falls back to the defaults for unknown values', () => {
    const html = renderPublished(makeSteps({ layout: 'diagonal', marker: 'star' }));
    expect(html).toContain('np-steps--vertical np-steps--number');
  });

  it('renders a step outside Steps as a div with the same classes', () => {
    const steps = makeSteps();
    const html = renderPublished({ ...steps.children![0], parentId: null });
    expect(html.startsWith('<div class="wp-block-step ')).toBe(true);
    expect(html).toContain('np-step__title');
  });

  it('keeps a non-step child inside the list in its own item', () => {
    const steps = makeSteps();
    const stray: BlockConfig = { ...steps.children![0].children![0], id: 'stray', parentId: 'steps' };
    const html = renderPublished({ ...steps, children: [...steps.children!, stray] });
    expect(html).toContain('np-steps__other');
  });
});

describe('Steps CSS', () => {
  it('numbers with a counter and hides the last connector', () => {
    expect(STEPS_CSS).toContain('counter-reset:np-step');
    expect(STEPS_CSS).toContain('counter-increment:np-step');
    expect(STEPS_CSS).toContain('content:counter(np-step)');
    expect(STEPS_CSS).toContain(':last-child::after');
  });

  it('turns horizontal into vertical on phones for pages and for the editor preview', () => {
    expect(STEPS_CSS).toContain('@media (max-width:767px)');
    expect(STEPS_CSS).toContain('@container npb-canvas (max-width:767px)');
    expect(STEPS_CSS).toContain('.npb-canvas-page .wp-block-steps.np-steps--horizontal');
  });

  it('animates nothing', () => {
    expect(STEPS_CSS).not.toMatch(/transition|animation/);
  });
});

describe('Steps editor', () => {
  it('shows the same structure as the published page', () => {
    const Component = blockRegistry['core/steps'].component as React.ComponentType<{
      value: BlockConfig;
      onChange: (next: BlockConfig) => void;
      isPreview?: boolean;
    }>;
    const { container } = render(
      <BlockActionsProvider value={stubActions}>
        <Component value={makeSteps({ layout: 'horizontal', marker: 'dot' })} onChange={() => {}} isPreview />
      </BlockActionsProvider>,
    );
    expect(container.querySelector('.wp-block-steps.np-steps--horizontal.np-steps--dot')).not.toBeNull();
    expect(container.querySelector('.np-steps__items')).not.toBeNull();
    expect(container.querySelectorAll('.wp-block-step')).toHaveLength(3);
    expect(screen.getByText('Second step')).toBeInTheDocument();
  });
});

describe('Steps settings', () => {
  it('adds a step with a title and a paragraph', () => {
    const onUpdate = vi.fn();
    render(<StepsSettings block={makeSteps()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: /Add step/ }));
    const children = onUpdate.mock.calls[0][0].children as BlockConfig[];
    expect(children).toHaveLength(4);
    expect(children[3]).toMatchObject({ name: 'core/step', parentId: 'steps', content: { data: { title: 'Step 4' } } });
    expect(children[3].children?.[0]).toMatchObject({ name: 'core/paragraph' });
  });

  it('changes the layout and marker with chips', () => {
    const onUpdate = vi.fn();
    render(<StepsSettings block={makeSteps()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('radio', { name: /In a row/ }));
    expect(JSON.stringify(onUpdate.mock.calls[0][0])).toContain('horizontal');
    fireEvent.click(screen.getByRole('radio', { name: /Dots/ }));
    expect(JSON.stringify(onUpdate.mock.calls[1][0])).toContain('"dot"');
  });

  it('edits a step title', () => {
    const onUpdate = vi.fn();
    const step = makeSteps().children![0];
    render(<StepSettings block={step} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Sign up' } });
    expect(JSON.stringify(onUpdate.mock.calls[0][0])).toContain('Sign up');
  });
});
