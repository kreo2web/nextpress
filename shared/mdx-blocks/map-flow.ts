import type { BlockConfig } from "../schema-types.js";
import type { MdxNode } from "../markdown/mdx-tree.js";
import { MAX_PARAMS, PARAMS_BLOCK_NAME, type ParamItem } from "../blocks/params-model.js";
import { MDX_FALLBACK_BLOCK_NAME } from "./block-names.js";
import { buildBlock } from "./build-block.js";
import { CORE_BLOCK_NAMES } from "./core-block-names.js";
import { flowNodes, isJsxElement } from "./mdx-flow.js";
import { mapComponent } from "./map-component.js";
import { mapElement } from "./map-element.js";
import type { MapContext, Mapped } from "./map-types.js";

/** Maps one element: a component through the tag table, anything else through the element table. */
const mapNode = ({ ctx, node }: { ctx: MapContext; node: MdxNode }): Mapped => {
	if (isJsxElement(node)) return mapComponent({ ctx, node });
	const block = mapElement({ ctx, node });
	return block ? { kind: "block", block } : null;
};

/**
 * The words of consecutive elements that no docs block holds, exactly as written: the source from the first
 * element's start to the last one's end, so nothing between them is lost either. Null when there are none.
 */
const markdownBlockFor = ({ ctx, nodes }: { ctx: MapContext; nodes: MdxNode[] }): BlockConfig | null => {
	if (nodes.length === 0) return null;
	const from = nodes[0].position?.start.offset;
	const to = nodes[nodes.length - 1].position?.end.offset;
	if (typeof from !== "number" || typeof to !== "number") throw new Error("A parsed MDX element has no position, so its words cannot be kept.");
	const content = ctx.source.slice(from, to).trim();
	return content ? buildBlock({ name: MDX_FALLBACK_BLOCK_NAME, newId: ctx.newId, fields: { content, mdx: true, className: "" } }) : null;
};

/**
 * Some MDX children (a page, or the children of a component) as blocks, in order. Consecutive parameters
 * become one docs/params block (split at the most it lists), consecutive accordion items one accordion, and
 * an element no block holds stays in a markdown block, word for word. Nothing is dropped.
 */
export const mapFlow = ({ ctx, nodes }: { ctx: MapContext; nodes: MdxNode[] }): BlockConfig[] => {
	const out: BlockConfig[] = [];
	let params: ParamItem[] = [];
	let accordionItems: BlockConfig[] = [];
	let unmapped: MdxNode[] = [];

	const flushParams = (): void => {
		const items = params;
		params = [];
		for (let start = 0; start < items.length; start += MAX_PARAMS) {
			out.push(buildBlock({ name: PARAMS_BLOCK_NAME, newId: ctx.newId, fields: { items: items.slice(start, start + MAX_PARAMS) } }));
		}
	};
	const flushAccordions = (): void => {
		const items = accordionItems;
		accordionItems = [];
		if (items.length > 0) out.push(buildBlock({ name: CORE_BLOCK_NAMES.accordion, newId: ctx.newId, fields: { openMode: "many", firstOpen: false }, children: items }));
	};
	const flushUnmapped = (): void => {
		const block = markdownBlockFor({ ctx, nodes: unmapped });
		unmapped = [];
		if (block) out.push(block);
	};

	for (const node of flowNodes(nodes)) {
		const mapped = mapNode({ ctx, node });
		if (mapped?.kind !== "param") flushParams();
		if (mapped?.kind !== "accordion") flushAccordions();
		if (!mapped) {
			unmapped.push(node);
			continue;
		}
		flushUnmapped();
		if (mapped.kind === "block") out.push(mapped.block);
		else if (mapped.kind === "param") params.push(mapped.item);
		else accordionItems.push(mapped.item);
	}
	flushParams();
	flushAccordions();
	flushUnmapped();
	return out;
};

/** The context the mappers share: the page's text, the id maker, and child mapping that reuses `mapFlow`. */
export const createMapContext = ({ source, newId }: { source: string; newId: () => string }): MapContext => {
	const ctx: MapContext = { source, newId, mapChildren: (nodes) => mapFlow({ ctx, nodes }) };
	return ctx;
};
