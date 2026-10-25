/**
 * The core blocks the MDX converter builds and writes: the ones docs pages use beside the docs blocks
 * (code, tables, images, quotes) and the layout blocks behind Tabs, Steps, Cards and Accordion. The docs
 * blocks have their own names in their model files.
 */
export const CORE_BLOCK_NAMES = {
	code: "core/code",
	table: "core/table",
	image: "core/image",
	separator: "core/separator",
	quote: "core/quote",
	paragraph: "core/paragraph",
	heading: "core/heading",
	list: "core/list",
	tabs: "core/tabs",
	tab: "core/tab",
	steps: "core/steps",
	step: "core/step",
	grid: "core/grid",
	card: "core/card",
	accordion: "core/accordion",
	accordionItem: "core/accordion-item",
} as const;
