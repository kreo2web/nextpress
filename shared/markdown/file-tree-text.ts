/** The parts of a markdown syntax tree this step reads. */
type TreeNode = { type: string; value?: string; children?: TreeNode[] };

const INDENT = "  ";

/** The words in a node, without its markup: `**app.ts**` is "app.ts". */
const textOf = (node: TreeNode): string => (node.children ? node.children.map(textOf).join("") : (node.value ?? ""));

/** The first line of an item. A whole-line bold name (`- **app.ts**`) marks the entry, the same as a trailing ` *`. */
const itemLine = (paragraph: TreeNode): string => {
	const parts = paragraph.children ?? [];
	const isBold = parts.length === 1 && parts[0].type === "strong";
	return `${textOf(paragraph).trim()}${isBold ? " *" : ""}`;
};

const listLines = ({ list, depth }: { list: TreeNode; depth: number }): string[] =>
	(list.children ?? []).flatMap((item) => {
		const parts = item.children ?? [];
		const paragraph = parts.find((part) => part.type === "paragraph");
		const own = paragraph ? [`${INDENT.repeat(depth)}${itemLine(paragraph)}`] : [];
		const nested = parts.filter((part) => part.type === "list").flatMap((inner) => listLines({ list: inner, depth: depth + 1 }));
		return [...own, ...nested];
	});

/**
 * The lines of a `<FileTree>` tag's content, in the file tree block's own text syntax, so both ways
 * in draw through the one parser. A markdown list gives one line per item, two spaces per level.
 * Plain lines of text (no list) are kept as they are.
 *
 * WHY: reading the syntax tree here is steadier than rebuilding the lines from the rendered
 * elements, where the nesting is already buried.
 */
export const fileTreeTextFromNodes = (nodes: TreeNode[]): string =>
	nodes
		.flatMap((node) => {
			if (node.type === "list") return listLines({ list: node, depth: 0 });
			return node.type === "paragraph" ? textOf(node).split("\n") : [];
		})
		.join("\n");
