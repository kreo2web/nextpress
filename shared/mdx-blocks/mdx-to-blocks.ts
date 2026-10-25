import { parseMdxAsWritten } from "../markdown/parse-markdown.js";
import type { BlockConfig } from "../schema-types.js";
import { createMapContext, mapFlow } from "./map-flow.js";

export type MdxToBlocksResult = { ok: true; blocks: BlockConfig[] } | { ok: false; message: string; line: number | null };

/**
 * A page written in MDX as docs blocks. Each element becomes the block it is: `## Heading`, a paragraph,
 * a list, a fenced code block, a table, an image, a quote, a rule, a diagram (```` ```mermaid ````), and
 * the components `<Callout>` (and `<Note>`, `<Tip>`…), `<CodeGroup>`, `<FileTree>`, `<Param>`, `<Example>`,
 * `<Tabs>`, `<Steps>`, `<Cards>`, `<Accordion>` and `<Update>`, with their children mapped the same way.
 * Anything no block holds (an unknown tag, a `#####` heading, `<Kbd>` in a sentence) stays in a markdown
 * block (MDX on), word for word, so nothing is dropped. Never throws: MDX that doesn't parse comes back with
 * the reason and the line.
 */
export const mdxToBlocks = ({ text, newId }: { text: string; newId: () => string }): MdxToBlocksResult => {
	const parsed = parseMdxAsWritten({ text });
	if (!parsed.ok) return parsed;
	const ctx = createMapContext({ source: parsed.source, newId });
	return { ok: true, blocks: mapFlow({ ctx, nodes: parsed.tree.children ?? [] }) };
};
