import { describe, expect, it } from 'vitest';
import type { BlockConfig } from '@shared/schema-types';
import { spliceTemplateParts } from '@/lib/template-parts/splice-template-parts';

const part = (id: string, templateId: string, parentId: string | null = null): BlockConfig => ({
  id,
  name: 'core/template-part',
  type: 'block',
  parentId,
  content: { kind: 'structured', data: { templateId } },
});

const heading = (id: string, text: string): BlockConfig => ({
  id,
  name: 'core/heading',
  type: 'block',
  parentId: null,
  content: { kind: 'text', value: text, level: 2 },
});

const texts = (blocks: BlockConfig[]): string[] =>
  blocks.flatMap((block) => [
    ...(block.content && 'value' in block.content ? [String(block.content.value)] : []),
    ...(block.children ? texts(block.children) : []),
  ]);

describe('live preview of linked template parts', () => {
  it("shows each part as its template's blocks, with ids unique per part", () => {
    const blocks = [part('p1', 'header'), heading('h', 'Body'), part('p2', 'header')];
    const result = spliceTemplateParts({ blocks, templates: { header: [heading('t1', 'Site header')] } });
    expect(texts(result)).toEqual(['Site header', 'Body', 'Site header']);
    expect(result.map((block) => block.id)).toEqual(['p1-1', 'h', 'p2-1']);
  });

  it('follows a part nested inside a template, and stops at a template that points back at itself', () => {
    const templates = {
      footer: [heading('f', 'Footer'), part('inner', 'legal')],
      legal: [heading('l', 'Legal line'), part('loop', 'legal')],
    };
    expect(texts(spliceTemplateParts({ blocks: [part('p', 'footer')], templates }))).toEqual(['Footer', 'Legal line']);
  });

  it('shows nothing for a part whose template is not loaded (or gone), like the published page', () => {
    expect(spliceTemplateParts({ blocks: [part('p', 'missing'), heading('h', 'Body')], templates: {} }).map((b) => b.id)).toEqual(['h']);
  });

  it('keeps parts inside containers in place', () => {
    const group: BlockConfig = { id: 'g', name: 'core/group', type: 'container', parentId: null, content: { kind: 'structured', data: {} }, children: [part('p', 'cta', 'g')] };
    const [result] = spliceTemplateParts({ blocks: [group], templates: { cta: [heading('c', 'Join us')] } });
    expect(result?.children?.map((child) => [child.id, child.parentId])).toEqual([['p-1', 'g']]);
  });
});
