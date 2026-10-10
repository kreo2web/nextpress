/**
 * Template rows come in two kinds. Pre-designed blocks are copied into a page. A linked template
 * part (`other.usage = "part"`) is shown on the page through a `core/template-part` block, so one
 * edit reaches every page that uses it. The kind lives in the existing `other` JSON column, so no
 * migration is needed. A row without the marker is a pre-designed block.
 */

export const TEMPLATE_PART_USAGE = "part";

/**
 * The `templates.type` stored for every linked part. What a part is (a header, a footer, anything)
 * is its one layout block, not a type: see `readTemplateRoot` in @shared/template-parts.
 */
export const TEMPLATE_PART_TYPE = "part";

export type TemplatePartMarker = { usage: typeof TEMPLATE_PART_USAGE; siteId: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** True when a template row is a linked part. Pre-designed blocks have no marker. */
export function isTemplatePart(other: unknown): boolean {
	return isRecord(other) && other.usage === TEMPLATE_PART_USAGE;
}

/** The site that owns a linked part, or null for pre-designed blocks and rows with no site recorded. */
export function readTemplatePartSiteId(other: unknown): string | null {
	if (!isTemplatePart(other) || !isRecord(other)) return null;
	const siteId = other.siteId;
	return typeof siteId === "string" && siteId.trim() !== "" ? siteId : null;
}

/** The marker written on a new linked part. The site is always the one the request was made for. */
export function buildTemplatePartMarker({ siteId }: { siteId: string }): TemplatePartMarker {
	return { usage: TEMPLATE_PART_USAGE, siteId };
}

/**
 * Keeps the marker fixed when a template is updated. A client may send `other` with any content,
 * but it must never turn a pre-designed block into a part, move a part to another site, or turn a
 * part back into a pre-designed block. The stored marker always wins.
 */
export function keepTemplateUsage({
	stored,
	incoming,
}: {
	stored: unknown;
	incoming: unknown;
}): Record<string, unknown> {
	const rest = isRecord(incoming) ? { ...incoming } : {};
	delete rest.usage;
	delete rest.siteId;
	if (!isTemplatePart(stored) || !isRecord(stored)) return rest;
	return { ...rest, usage: TEMPLATE_PART_USAGE, siteId: stored.siteId };
}
