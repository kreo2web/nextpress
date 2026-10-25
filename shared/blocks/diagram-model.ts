import type { BlockContent } from "../schema-types.js";
import { readStructuredData, readText } from "./read-structured.js";

export const DIAGRAM_BLOCK_NAME = "docs/diagram";

/**
 * A diagram drawn from Mermaid text (flowcharts, sequence diagrams, state machines) as an SVG
 * picture. `code` is the Mermaid text; `caption` is an optional line under the picture. In MDX it is
 * a ```` ```mermaid ```` fence, with the caption as the fence's `title`.
 */
export type DiagramContent = { code: string; caption: string };

export const DEFAULT_DIAGRAM_CONTENT: DiagramContent = { code: "flowchart LR\n  Write --> Review\n  Review --> Publish", caption: "" };

export function readDiagramContent(content: BlockContent | undefined): DiagramContent {
	const data = readStructuredData(content);
	return { code: readText(data.code), caption: readText(data.caption) };
}
