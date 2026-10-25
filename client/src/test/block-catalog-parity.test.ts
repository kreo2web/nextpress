import { describe, expect, it } from 'vitest';
import { BLOCK_NAMES, createDefaultBlock, getBlockEntry } from '@shared/block-catalog';
import { KNOWN_BLOCK_NAMES } from '@shared/known-block-names';

// Load the renderer entry first: the renderer modules import each other through the block table.
await import('../../../renderer/react/render-helpers');
const { blockRegistry } = await import('@/components/PageBuilder/blocks');

/**
 * The editor, the server's save check and the SDK read one block list
 * (`shared/block-catalog/`). This fails the moment the editor and the list disagree.
 */
describe('block catalog parity', () => {
  it('editor, server and catalog name the same blocks', () => {
    const sorted = (names: readonly string[]) => [...names].sort();
    expect(sorted(Object.keys(blockRegistry))).toEqual(sorted(BLOCK_NAMES));
    expect(sorted(KNOWN_BLOCK_NAMES)).toEqual(sorted(BLOCK_NAMES));
  });

  it.each([...BLOCK_NAMES])('%s: editor definition matches the catalog', (name) => {
    const def = blockRegistry[name];
    const entry = getBlockEntry(name);
    expect(def.id).toBe(entry.name);
    expect(def.label).toBe(entry.label);
    expect(def.description).toBe(entry.description);
    expect(def.category).toBe(entry.category);
    expect(def.alsoIn).toEqual(entry.alsoIn);
    expect(Boolean(def.isContainer)).toBe(entry.kind === 'container');
    expect(def.defaultStyles).toEqual(entry.defaultStyles);
    expect(def.defaultContent).toEqual(entry.defaultContent());
    expect(def.defaultChildren).toBe(entry.defaultChildren);
  });

  it.each([...BLOCK_NAMES])('%s: catalog makes the block the editor inserts', async (name) => {
    const { getDefaultBlock } = await import('@/components/PageBuilder/blocks');
    let n = 0;
    const fromCatalog = createDefaultBlock({ name, id: 'b', newId: () => `id-${++n}` });
    expect(fromCatalog).not.toBeNull();
    const fromEditor = getDefaultBlock(name, 'b');
    // Starting children carry fresh ids from the editor, so compare their shape without ids.
    const withoutChildIds = (block: typeof fromCatalog) =>
      JSON.parse(JSON.stringify(block, (key, value) => (key === 'id' || key === 'parentId' ? undefined : value)));
    expect(withoutChildIds(fromEditor)).toEqual(withoutChildIds(fromCatalog));
  });
});
