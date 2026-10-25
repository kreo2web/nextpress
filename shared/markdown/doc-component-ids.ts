import { docComponentTag } from "./safe-mdx.js";

type IdNode = { data?: { hName?: string; hProperties?: Record<string, string> }; children?: IdNode[] };

const NUMBERED_TAGS: ReadonlySet<string> = new Set([docComponentTag("Tabs"), docComponentTag("CodeGroup")]);

/**
 * A remark step, run after `remarkSafeMdx`, that numbers every `<Tabs>` and `<CodeGroup>` in the
 * text (1, 2, …, in reading order) as an `index` property. Tab ids are built from it, so two tab
 * sets in one markdown block never share an id. It is set here, after the author's props are
 * filtered, so authors can never choose it; and in the parse (not while React renders) so a
 * re-render can never renumber them and the server and editor agree.
 */
export const remarkDocComponentIds = () => (tree: IdNode): void => {
	let count = 0;
	const walk = (node: IdNode): void => {
		if (node.data?.hName && NUMBERED_TAGS.has(node.data.hName)) {
			count += 1;
			node.data = { ...node.data, hProperties: { ...node.data.hProperties, index: String(count) } };
		}
		node.children?.forEach(walk);
	};
	walk(tree);
};
