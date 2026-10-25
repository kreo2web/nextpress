import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BlockConfig } from '@shared/schema-types';
// Load the renderer entry first: the renderer modules import each other through the block table.
import { getBlockComponent } from '../../../renderer/react/render-helpers';
import { MarkdownView } from '@shared/markdown';
import { STEPS_CSS } from '@shared/blocks/steps-css';
import { readStepContent } from '@shared/blocks/steps-model';
import { BlockActionsProvider, type BlockActionsContextValue } from '@/components/PageBuilder/BlockActionsContext';
import { blockRegistry } from '@/components/PageBuilder/blocks';

const stubActions: BlockActionsContextValue = {
  selectedBlockId: null, editingBlockId: null, hoveredBlockId: null, onSelect: () => {}, onStartEditing: () => {},
  onStopEditing: () => {}, onHoverBlock: () => {}, onDuplicate: () => {}, onDelete: () => {}, hoverHighlight: null,
};

const para = (id: string, parentId: string): BlockConfig => ({
  id, name: 'core/paragraph', type: 'block', parentId, label: 'Paragraph', category: 'basic',
  content: { kind: 'text', value: 'text' }, styles: {}, settings: {},
});
const step = (id: string, title: string, icon?: Record<string, string>): BlockConfig => ({
  id, name: 'core/step', type: 'container', parentId: 's1', label: 'Step', category: 'layout',
  content: { kind: 'structured', data: icon ? { title, icon } : { title } }, styles: {}, settings: {}, children: [para(`${id}p`, id)],
});
const steps = (data: Record<string, string>, kids: BlockConfig[]): BlockConfig => ({
  id: 's1', name: 'core/steps', type: 'container', parentId: null, label: 'Steps', category: 'layout',
  content: { kind: 'structured', data }, styles: {}, settings: {}, children: kids,
});
const rocket = { iconSet: 'lucide', iconName: 'rocket' };
const three = [step('a', 'One', rocket), step('b', 'Two'), step('c', 'Three')];
const published = (b: BlockConfig): string => {
  const C = getBlockComponent(b.name);
  if (!C) throw new Error('missing renderer');
  return renderToStaticMarkup(<C {...b} />);
};
const mdx = (t: string) => renderToStaticMarkup(<MarkdownView text={t} mdx idPrefix="x" />);

describe('Steps arrow connector (CSS)', () => {
  const horizontal = STEPS_CSS.split('\n').filter((l) => l.includes('.np-steps--horizontal') && l.includes('::after') && !l.includes('@'));
  it('draws an arrow with a mask in the row layout, using the line colour', () => {
    const rule = horizontal.find((l) => l.includes('mask:'));
    expect(rule).toBeDefined();
    expect(rule).toContain('data:image/svg+xml');
    expect(STEPS_CSS).toContain('--np-steps-line:var(--npb-text-muted');
  });
  it('starts after this marker and ends before the next one, so it never touches either', () => {
    const rule = horizontal.find((l) => l.includes('mask:')) ?? '';
    expect(rule).toContain('left:calc(var(--np-steps-marker,2rem) + var(--np-steps-clear,0.5rem))');
    expect(rule).toContain('right:calc(var(--np-steps-clear,0.5rem) - var(--np-steps-gap,1.5rem))');
  });
  it('keeps the plain timeline line for vertical and switches the mask off', () => {
    expect(STEPS_CSS).toContain('width:2px;height:auto;-webkit-mask:none;mask:none');
  });
  it('hides the connector on the last step and puts phones back to vertical, twice', () => {
    expect(STEPS_CSS).toMatch(/:last-child \.wp-block-step::after\{display:none\}/);
    expect(STEPS_CSS).toMatch(/@container npb-canvas \(max-width:767px\)\{\s*\.npb-canvas-page \.wp-block-steps\.np-steps--horizontal/);
    expect(STEPS_CSS).toMatch(/@media \(max-width:767px\)\{\s*\.wp-block-steps\.np-steps--horizontal/);
    expect(STEPS_CSS).not.toMatch(/transition|animation/);
  });
});

describe('Steps icon marker', () => {
  it('draws the chosen icon svg in the published step', () => {
    const html = published(steps({ marker: 'icon' }, three));
    expect(html).toContain('np-steps--icon');
    expect(html.match(/class="np-step__icon"/g)).toHaveLength(3);
    expect(html).toContain('lucide-rocket');
    expect(html).toContain('lucide-check'); // default for steps with no icon saved
  });
  it('draws no icon element for numbers or dots, so numbers (counters) come back', () => {
    for (const marker of ['number', 'dot']) {
      const html = published(steps({ marker }, three));
      expect(html).not.toContain('np-step__icon');
      expect(html).toContain(`np-steps--${marker}`);
    }
    expect(STEPS_CSS).toContain('content:counter(np-step)');
  });
  it('keeps the icon when switching away and back', () => {
    const away = published(steps({ marker: 'number' }, three));
    const back = published(steps({ marker: 'icon' }, three));
    expect(away).not.toContain('lucide-rocket');
    expect(back).toContain('lucide-rocket');
  });
  it('renumbers by order: numbers are counters, with nothing saved', () => {
    const swapped = published(steps({}, [three[1], three[0], three[2]]));
    expect(swapped.indexOf('Two')).toBeLessThan(swapped.indexOf('One'));
    expect(swapped).not.toMatch(/>\s*[123]\s*</);
    expect(STEPS_CSS).toContain('counter-increment:np-step');
  });
  it('falls back to the check for a bad icon', () => {
    expect(readStepContent({ kind: 'structured', data: { icon: { iconSet: 'nope', iconName: 'x' } } }).icon.iconName).toBe('check');
    const html = published(steps({ marker: 'icon' }, [step('a', 'A', { iconSet: 'lucide', iconName: 'not-an-icon' })]));
    expect(html).toContain('lucide-check');
  });
  it('draws the icon on the editor canvas too', () => {
    const C = blockRegistry['core/steps'].component as React.ComponentType<{ value: BlockConfig; onChange: () => void; isPreview?: boolean }>;
    const { container } = render(
      <BlockActionsProvider value={stubActions}><C value={steps({ marker: 'icon' }, three)} onChange={() => {}} isPreview /></BlockActionsProvider>,
    );
    expect(container.querySelectorAll('.np-step__icon')).toHaveLength(3);
    expect(container.querySelector('.np-step__icon svg.lucide-rocket')).not.toBeNull();
  });
});

describe('MDX icon steps match the block', () => {
  it('same structure and icons', () => {
    const blockHtml = published(steps({ marker: 'icon' }, [step('a', 'Install', rocket), step('b', 'Use', { iconSet: 'lucide', iconName: 'check' })]));
    const mdxHtml = mdx('<Steps marker="icon">\n<Step title="Install" icon="rocket">\nx\n</Step>\n<Step title="Use" icon="check">\ny\n</Step>\n</Steps>');
    const shape = (h: string): string[] => {
      const root = document.createElement('div');
      root.innerHTML = h;
      return Array.from(root.querySelectorAll('*')).flatMap((el) => {
        const names = Array.from(el.classList).filter((c) => /^(wp-block-steps|wp-block-step|np-steps--.*|np-step__.*|lucide-[a-z-]+)$/.test(c)).sort();
        return names.length > 0 ? [`${el.tagName.toLowerCase()}.${names.join('.')}`] : [];
      });
    };
    expect(shape(mdxHtml)).toEqual(shape(blockHtml));
    expect(mdxHtml).toContain('np-steps--icon');
    expect(mdxHtml).toContain('lucide-rocket');
  });
  it('unknown or missing icon names show the check; other markers show none', () => {
    expect(mdx('<Steps marker="icon">\n<Step title="A" icon="zzz">\nx\n</Step>\n<Step title="B">\ny\n</Step>\n</Steps>').match(/lucide-check/g)).toHaveLength(2);
    expect(mdx('<Steps>\n<Step title="A" icon="rocket">\nx\n</Step>\n</Steps>')).not.toContain('np-step__icon');
  });
});
