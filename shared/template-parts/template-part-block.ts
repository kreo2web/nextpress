import type { BlockConfig } from "../schema-types.js";

/** Canonical block name of a linked template part. */
export const TEMPLATE_PART_BLOCK_NAME = "core/template-part";

/**
 * How many levels of templates may nest. The page's own parts are level 1, a part inside one of
 * those templates is level 2, and so on. Deeper parts are left out. The server and the editor
 * canvas both read this one number, so what the editor shows is what the page publishes.
 */
export const MAX_TEMPLATE_PART_DEPTH = 3;

export type TemplatePartContent = { templateId: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export const isTemplatePartBlock = (block: Pick<BlockConfig, "name">): boolean =>
	block.name === TEMPLATE_PART_BLOCK_NAME;

/**
 * The template a part points at, or null when no template is chosen yet. Structured blocks store
 * their fields under `data`, so the id is read there. A bare `{ templateId }` is accepted as well.
 */
export function readTemplatePartId(block: Pick<BlockConfig, "content">): string | null {
	const raw: unknown = block.content;
	if (!isRecord(raw)) return null;
	const fields = raw.kind === "structured" && isRecord(raw.data) ? raw.data : raw;
	const templateId = fields.templateId;
	return typeof templateId === "string" && templateId.trim() !== "" ? templateId.trim() : null;
}

/** A new part block that points at a template. Content is stored like every other structured block. */
export function buildTemplatePartBlock({
	id,
	templateId,
}: {
	id: string;
	templateId: string;
}): BlockConfig {
	return {
		id,
		name: TEMPLATE_PART_BLOCK_NAME,
		label: "Template",
		type: "block",
		parentId: null,
		category: "layout",
		content: { kind: "structured", data: { templateId } },
		styles: {},
		settings: {},
		other: {
			tokenMap: {},
			units: { spacing: "px", font: "rem", dimension: "px", border: "px" },
		},
	};
}
