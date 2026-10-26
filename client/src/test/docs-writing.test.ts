import { describe, expect, it } from 'vitest';
import type { BlockConfig } from '@shared/schema-types';
import { readSlashQuery, readWritingTurn, removeEmptyBlock, replaceBlock, splitBlock, splitText } from '@/components/PageBuilder/docs-mode/docs-writing';

const counter = () => {
  let n = 0;
  return () => `new-${++n}`;
};

const text = (id: string, value: string): BlockConfig => ({ id, name: 'docs/text', label: 'Text', type: 'block', parentId: 'page', content: { kind: 'structured', data: { text: value } } });
const heading = (id: string, value: string): BlockConfig => ({ id, name: 'docs/heading', label: 'Heading', type: 'block', parentId: 'page', content: { kind: 'structured', data: { level: 2, text: value, anchor: '' } } });
const page = (children: BlockConfig[]): BlockConfig[] => [{ id: 'page', name: 'docs/page', label: 'Docs page', type: 'block', parentId: null, content: { kind: 'structured', data: {} }, children }];

const childrenOf = (blocks: BlockConfig[]): BlockConfig[] => blocks[0].children ?? [];
type StructuredData = Extract<NonNullable<BlockConfig['content']>, { kind: 'structured' }>['data'];
const dataOf = (block: BlockConfig): StructuredData => (block.content && 'kind' in block.content && block.content.kind === 'structured' ? block.content.data : {});
const allIds = (blocks: BlockConfig[]): string[] => blocks.flatMap((block) => [block.id, ...allIds(block.children ?? [])]);

describe('markers typed at the start of a paragraph', () => {
  it('make a heading, list, numbered list, checklist, quote or code block, taking the rest of the text along', () => {
    expect(readWritingTurn({ previous: '##', next: '## ' })).toEqual({ name: 'docs/heading', data: { level: 2, text: '', anchor: '' } });
    expect(readWritingTurn({ previous: '###Setup', next: '### Setup' })).toMatchObject({ name: 'docs/heading', data: { level: 3, text: 'Setup' } });
    expect(readWritingTurn({ previous: '-', next: '- ' })).toMatchObject({ name: 'docs/list', data: { style: 'bullet' } });
    expect(readWritingTurn({ previous: '1.', next: '1. ' })).toMatchObject({ name: 'docs/list', data: { style: 'number' } });
    expect(readWritingTurn({ previous: '[]', next: '[] ' })).toMatchObject({ name: 'docs/list', data: { style: 'check' } });
    expect(readWritingTurn({ previous: '>', next: '> Be <careful>' })).toEqual({ name: 'core/quote', data: { value: '<p>Be &lt;careful&gt;</p>', citation: '' } });
    expect(readWritingTurn({ previous: '``', next: '```' })).toEqual({ name: 'core/code', data: { content: '', language: '' } });
  });

  it('leave a paragraph alone once it already started that way, or when the marker is not at the start', () => {
    expect(readWritingTurn({ previous: '- a', next: '- ab' })).toBeNull();
    expect(readWritingTurn({ previous: 'Step', next: 'Step ## ' })).toBeNull();
    expect(readWritingTurn({ previous: '#', next: '# ' })).toBeNull();
  });
});

describe('the "/" menu', () => {
  it('opens for a paragraph that starts with "/" and reads what follows as the search', () => {
    expect(readSlashQuery('/')).toBe('');
    expect(readSlashQuery('/code gr')).toBe('code gr');
    expect(readSlashQuery('Use /docs')).toBeNull();
    expect(readSlashQuery('/a/b')).toBeNull();
  });
});

describe('Enter and Backspace', () => {
  it('Enter keeps the text before the caret and starts a new paragraph after it with the rest', () => {
    expect(splitText({ text: 'Hello world', start: 5, end: 5 })).toEqual({ before: 'Hello', after: ' world' });
    const result = splitBlock({ blocks: page([text('a', 'Hello world'), text('b', 'Next')]), blockId: 'a', field: 'text', before: 'Hello', after: ' world', newId: counter() });

    expect(result?.caret).toBe('start');
    const children = childrenOf(result!.blocks);
    expect(children.map((child) => child.id)).toEqual(['a', result!.editId, 'b']);
    expect(dataOf(children[0]).text).toBe('Hello');
    expect(children[1]).toMatchObject({ name: 'docs/text', parentId: 'page' });
    expect(dataOf(children[1]).text).toBe(' world');
  });

  it('Enter in a heading starts a paragraph under it', () => {
    const result = splitBlock({ blocks: page([heading('h', 'Install')]), blockId: 'h', field: 'text', before: 'Install', after: '', newId: counter() });
    expect(childrenOf(result!.blocks).map((child) => child.name)).toEqual(['docs/heading', 'docs/text']);
  });

  it('Backspace in an empty paragraph removes it and carries on at the end of the block above', () => {
    const result = removeEmptyBlock({ blocks: page([heading('h', 'Install'), text('a', '')]), blockId: 'a' });
    expect(childrenOf(result!.blocks).map((child) => child.id)).toEqual(['h']);
    expect(result).toMatchObject({ editId: 'h', caret: 'end' });
  });

  it('Backspace in the first paragraph removes it and opens nothing', () => {
    const result = removeEmptyBlock({ blocks: page([text('a', ''), text('b', 'More')]), blockId: 'a' });
    expect(result?.editId).toBeNull();
  });
});

describe('turning a paragraph into another block', () => {
  it('puts the new block where the paragraph was, with fresh ids for it and every block inside it', () => {
    const result = replaceBlock({ blocks: page([text('a', '/code'), text('b', 'Next')]), blockId: 'a', name: 'docs/code-group', newId: counter() });

    const children = childrenOf(result!.blocks);
    expect(children.map((child) => child.name)).toEqual(['docs/code-group', 'docs/text']);
    expect(result?.editId).toBe(children[0].id);
    const ids = allIds(result!.blocks);
    expect(new Set(ids).size).toBe(ids.length);
    expect((children[0].children ?? []).length).toBeGreaterThan(1);
  });

  it('starts the new block with the fields given', () => {
    const result = replaceBlock({ blocks: page([text('a', '## ')]), blockId: 'a', name: 'docs/heading', data: { level: 3, text: 'Setup', anchor: '' }, newId: counter() });
    expect(dataOf(childrenOf(result!.blocks)[0])).toMatchObject({ level: 3, text: 'Setup' });
  });

  it('refuses a block NextPress does not know, leaving the page as it was', () => {
    expect(replaceBlock({ blocks: page([text('a', 'x')]), blockId: 'a', name: 'docs/nope', newId: counter() })).toBeNull();
  });
});

describe('blocks added to a docs page by click or drag', () => {
  it('line up with its text; blocks added to an ordinary page keep the page builder padding', async () => {
    const { insertNewBlock } = await import('@/lib/handlers/treeUtils');
    const docsTree = page([text('a', 'Hi')]);
    const inDocs = insertNewBlock(docsTree, 'page', 1, 'core/code');
    const added = childrenOf(inDocs.blocks).find((child) => child.id === inDocs.newId);
    expect(added?.styles?.padding).toBe('20px 0 0');

    const plain: BlockConfig[] = [{ id: 'group', name: 'core/group', label: 'Group', type: 'container', parentId: null, content: { kind: 'structured', data: {} }, children: [] }];
    const inPage = insertNewBlock(plain, 'group', 0, 'core/code');
    expect(inPage.blocks[0].children?.[0].styles?.padding).toBe('20px 20px 0');
  });
});
