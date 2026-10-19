import { describe, expect, it, vi } from 'vitest';

/**
 * Locks what every block looks like when the editor inserts it.
 * Taken before the block list moved into `shared/block-catalog/` (2026-10-16),
 * so the move is proven to change nothing a person sees.
 * Ids are made predictable; keys are sorted so a reordered object is not a change.
 */

let idCounter = 0;
vi.mock('@/components/PageBuilder/utils', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/components/PageBuilder/utils')>();
  return { ...original, generateBlockId: () => `id-${++idCounter}` };
});

// Load the renderer entry first: the renderer modules import each other through the block table.
await import('../../../renderer/react/render-helpers');
const { blockRegistry, getDefaultBlock } = await import('@/components/PageBuilder/blocks');

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const sortKeys = (value: unknown): Json => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  if (typeof value === 'function') return '[function]';
  return (value ?? null) as Json;
};

const describeBlock = (name: string) => {
  idCounter = 0;
  const def = blockRegistry[name];
  return {
    id: def.id,
    label: def.label,
    description: def.description,
    category: def.category,
    isContainer: def.isContainer ?? false,
    handlesOwnChildren: def.handlesOwnChildren ?? false,
    hasSettings: def.hasSettings ?? false,
    defaultContent: def.defaultContent,
    defaultStyles: def.defaultStyles,
    inserted: getDefaultBlock(name, 'block-under-test'),
  };
};

describe('block defaults snapshot', () => {
  it('every block inserts exactly as before', async () => {
    const names = Object.keys(blockRegistry).sort();
    const snapshot = sortKeys(Object.fromEntries(names.map((name) => [name, describeBlock(name)])));
    await expect(JSON.stringify(snapshot, null, 2)).toMatchFileSnapshot(
      './__snapshots__/block-defaults.snapshot.json',
    );
  });

  it('inserting the same block twice gives the same result', () => {
    for (const name of Object.keys(blockRegistry)) {
      expect(sortKeys(describeBlock(name))).toEqual(sortKeys(describeBlock(name)));
    }
  });
});
