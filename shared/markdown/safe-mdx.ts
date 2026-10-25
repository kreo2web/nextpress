import { fileTreeTextFromNodes } from "./file-tree-text.js";

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
	data?: { hName?: string; hProperties?: Record<string, string>; hChildren?: MdNode[] };
};

/** The JavaScript tree MDX attaches to a `{…}` attribute. Only read, never run. */
type EstreeNode = { type: string; body?: EstreeNode[]; expression?: EstreeNode; value?: string | number | boolean | null | object };

export type MdAttributeExpression = { type?: string; value?: string; data?: { estree?: EstreeNode | null } };

type MdAttribute = { type: string; name?: string; value?: string | null | MdAttributeExpression };

/** The HTML tag a component becomes on its way to React: lower case with a prefix, so it can't clash with real HTML. */
export const docComponentTag = (name: string): string => `np-${name.toLowerCase()}`;

const textNode = (value: string): MdNode => ({ type: "text", value });

/**
 * What `prop={…}` says, when the expression is exactly one number, true or string literal
 * (`cols={2}`, `required={true}`, `title={"Hi"}`). Read from the parsed tree, never evaluated.
 * `{false}`, `{null}`, names, templates, calls and objects give nothing. Shared with the docs converter.
 */
export const readLiteralExpression = (value: MdAttributeExpression): string | undefined => {
	const program = value.data?.estree;
	if (program?.type !== "Program" || program.body?.length !== 1) return undefined;
	const statement = program.body[0];
	if (statement.type !== "ExpressionStatement" || statement.expression?.type !== "Literal") return undefined;
	const literal = statement.expression.value;
	if (typeof literal === "string") return literal;
	if (typeof literal === "number") return Number.isFinite(literal) ? String(literal) : undefined;
	return literal === true ? "true" : undefined;
};

/** Literal props the component allows. A bare prop (`<Tab default>`) is "true"; `prop={2}` is its literal; any other `{…}` is dropped. */
const readProps = ({ attributes, allowed }: { attributes: MdAttribute[]; allowed: readonly string[] }): Record<string, string> =>
	Object.fromEntries(
		attributes.flatMap((attribute) => {
			if (attribute.type !== "mdxJsxAttribute" || !attribute.name || !allowed.includes(attribute.name)) return [];
			if (attribute.value === null || attribute.value === undefined) return [[attribute.name, "true"]];
			const text = typeof attribute.value === "string" ? attribute.value : readLiteralExpression(attribute.value);
			return text === undefined ? [] : [[attribute.name, text]];
		}),
	);

const isJsxElement = (node: MdNode): boolean => node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement";

/** Tags that sit inside a line of text. Every other component is a box, so alone on a line it must not be wrapped in a paragraph. */
const INLINE_COMPONENTS: readonly string[] = ["Kbd", "Badge"];

const isBoxComponent = (node: MdNode): boolean =>
	isJsxElement(node) && node.data?.hName !== undefined && !INLINE_COMPONENTS.includes(node.name ?? "");

/**
 * A paragraph that holds nothing but box components and the line breaks between them: the
 * components alone. Tags written on back-to-back lines (`<Tab>…</Tab>` then `<Tab>…</Tab>`) parse as
 * one paragraph, which would hide the tabs from Tabs, leave an empty cell in Cards and split a
 * Param list. Null when the paragraph has real text, so `Press <Kbd>K</Kbd>` stays a paragraph.
 */
const unwrapBoxComponents = (children: MdNode[]): MdNode[] | null => {
	const parts = children.filter((child) => !(child.type === "text" && !(child.value ?? "").trim()));
	return parts.length > 0 && parts.every(isBoxComponent) ? parts : null;
};

/** One node made safe: the nodes that take its place (none, itself, or its children). */
const cleanNode = ({ node, allowlist }: { node: MdNode; allowlist: DocComponentAllowlist }): MdNode[] => {
	if (node.type === "mdxjsEsm") return [];
	if (node.type === "mdxTextExpression") return [textNode(`{${node.value ?? ""}}`)];
	if (node.type === "mdxFlowExpression") return [{ type: "paragraph", children: [textNode(`{${node.value ?? ""}}`)] }];

	const children = (node.children ?? []).flatMap((child) => cleanNode({ node: child, allowlist }));
	if (node.type === "paragraph") {
		const boxes = unwrapBoxComponents(children);
		if (boxes) return boxes;
	}
	if (!isJsxElement(node)) return [node.children ? { ...node, children } : node];

	const allowed = node.name ? allowlist[node.name] : undefined;
	if (!allowed || !node.name) return children;
	const data: MdNode["data"] = { hName: docComponentTag(node.name), hProperties: readProps({ attributes: node.attributes ?? [], allowed }) };
	// A file tree's list becomes the block's own text lines, so one parser draws both. The lines go in as
	// ready-made output: markdown's own text step would strip the indent that gives the nesting.
	if (node.name === "FileTree") data.hChildren = [textNode(fileTreeTextFromNodes(children))];
	return [{ ...node, children, data }];
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
