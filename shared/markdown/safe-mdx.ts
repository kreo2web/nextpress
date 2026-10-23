/**
 * The MDX components a page may use, by the name authors write (`<Callout>`), with the props
 * each accepts. Props are plain text only: nothing an author writes is ever run.
 */
export type DocComponentAllowlist = Readonly<Record<string, readonly string[]>>;

/** The parts of a markdown syntax tree this step reads or writes. */
type MdNode = {
	type: string;
	name?: string | null;
	value?: string;
	attributes?: MdAttribute[];
	children?: MdNode[];
	data?: { hName?: string; hProperties?: Record<string, string> };
};

type MdAttribute = { type: string; name?: string; value?: string | null | object };

/** The HTML tag a component becomes on its way to React: lower case with a prefix, so it can't clash with real HTML. */
export const docComponentTag = (name: string): string => `np-${name.toLowerCase()}`;

const textNode = (value: string): MdNode => ({ type: "text", value });

/** Literal props the component allows. A bare prop (`<Tab default>`) is "true"; `prop={…}` is dropped. */
const readProps = ({ attributes, allowed }: { attributes: MdAttribute[]; allowed: readonly string[] }): Record<string, string> =>
	Object.fromEntries(
		attributes.flatMap((attribute) => {
			if (attribute.type !== "mdxJsxAttribute" || !attribute.name || !allowed.includes(attribute.name)) return [];
			if (attribute.value === null || attribute.value === undefined) return [[attribute.name, "true"]];
			return typeof attribute.value === "string" ? [[attribute.name, attribute.value]] : [];
		}),
	);

const isJsxElement = (node: MdNode): boolean => node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement";

/** One node made safe: the nodes that take its place (none, itself, or its children). */
const cleanNode = ({ node, allowlist }: { node: MdNode; allowlist: DocComponentAllowlist }): MdNode[] => {
	if (node.type === "mdxjsEsm") return [];
	if (node.type === "mdxTextExpression") return [textNode(`{${node.value ?? ""}}`)];
	if (node.type === "mdxFlowExpression") return [{ type: "paragraph", children: [textNode(`{${node.value ?? ""}}`)] }];

	const children = (node.children ?? []).flatMap((child) => cleanNode({ node: child, allowlist }));
	if (!isJsxElement(node)) return [node.children ? { ...node, children } : node];

	const allowed = node.name ? allowlist[node.name] : undefined;
	if (!allowed || !node.name) return children;
	return [
		{
			...node,
			children,
			data: { hName: docComponentTag(node.name), hProperties: readProps({ attributes: node.attributes ?? [], allowed }) },
		},
	];
};

/**
 * A remark step that makes parsed MDX safe to render without running it:
 * - `import` / `export` lines are dropped;
 * - `{expressions}` show as the text the author wrote (so a stray brace never eats words);
 * - allowed components keep their literal props and their markdown children;
 * - any other tag is unwrapped: its content stays, the tag goes.
 *
 * WHY: docs written for other tools are MDX, so authors write MDX. A CMS with many authors must
 * never evaluate it; the allowlist is the whole contract.
 */
export const remarkSafeMdx =
	({ components }: { components: DocComponentAllowlist }) =>
	(tree: MdNode): void => {
		tree.children = (tree.children ?? []).flatMap((child) => cleanNode({ node: child, allowlist: components }));
	};
