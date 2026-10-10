import type { BlockConfig } from "@shared/schema-types";
import {
	copyTemplateBlocks,
	hasTemplatePartBlock,
	isTemplatePartBlock,
	MAX_TEMPLATE_PART_DEPTH,
	readTemplatePartId,
} from "@shared/template-parts";
import { isTemplatePart, readTemplatePartSiteId } from "@shared/template-usage";
import { safeTryAsync } from "../../utils";

/** A template row as the resolver reads it. */
export type LoadedTemplate = {
	id: string;
	other: unknown;
	blocks: BlockConfig[];
	updatedAt: Date | string | null;
};

/** Returns the template with this id, or null when there is no such row. */
export type LoadTemplate = (templateId: string) => Promise<LoadedTemplate | null>;

/** A linked template that was shown on the page. Its id and update time go into the published-HTML cache key. */
export type UsedTemplatePart = { id: string; updatedAt: number };

export type ResolvedTemplateParts = {
	blocks: BlockConfig[];
	usedTemplates: UsedTemplatePart[];
};

export type TemplatePartSkipReason =
	| "no-template"
	| "too-deep"
	| "self-reference"
	| "missing"
	| "not-a-part"
	| "other-site"
	| "load-failed";

type LoadResult = { ok: true; template: LoadedTemplate | null } | { ok: false; error: Error };

const toTimestamp = (value: Date | string | null): number => {
	if (!value) return 0;
	const time = new Date(value).getTime();
	return Number.isNaN(time) ? 0 : time;
};

/**
 * Ids for the blocks a part brings in. They start from the part's own id, so they are unique on the
 * page (one template may appear twice) and stable while the template's content does not change.
 */
const sequentialIds = (prefix: string): (() => string) => {
	let next = 0;
	return () => {
		next += 1;
		return `${prefix}-${next}`;
	};
};

const loadTemplateSafely = async ({
	loadTemplate,
	templateId,
}: {
	loadTemplate: LoadTemplate;
	templateId: string;
}): Promise<LoadResult> => {
	const { err, result } = await safeTryAsync(() => loadTemplate(templateId));
	if (err) return { ok: false, error: err };
	return { ok: true, template: result };
};

/**
 * Replaces every `core/template-part` block with the current blocks of its template, so a page
 * shows the template as it is now. Published HTML, public and preview JSON, and page export all
 * call this. The editor never does: it must keep the part, so that the page still points at the
 * template.
 *
 * A part is left out, and logged with the page and template ids, when it has no template, when the
 * template is gone, when the template is not a linked part of this site, when it points back at a
 * template already on its path, or when it sits deeper than MAX_TEMPLATE_PART_DEPTH levels. A
 * page with no parts returns without any lookup.
 */
export async function resolveTemplateParts({
	blocks,
	siteId,
	pageId,
	loadTemplate,
}: {
	blocks: BlockConfig[];
	siteId: string | null;
	pageId: string;
	loadTemplate: LoadTemplate;
}): Promise<ResolvedTemplateParts> {
	if (!hasTemplatePartBlock(blocks)) return { blocks, usedTemplates: [] };

	const loads = new Map<string, Promise<LoadResult>>();
	const used = new Map<string, number>();

	const loadOnce = (templateId: string): Promise<LoadResult> => {
		const existing = loads.get(templateId);
		if (existing) return existing;
		const pending = loadTemplateSafely({ loadTemplate, templateId });
		loads.set(templateId, pending);
		return pending;
	};

	const skip = (
		templateId: string | null,
		reason: TemplatePartSkipReason,
		error?: Error,
	): BlockConfig[] => {
		console.warn("[template-parts] Left a template part out of the page", {
			atFunction: "resolveTemplateParts",
			pageId,
			siteId,
			templateId,
			reason,
			...(error ? { error } : {}),
		});
		return [];
	};

	const expandPart = async (
		part: BlockConfig,
		depth: number,
		chain: readonly string[],
	): Promise<BlockConfig[]> => {
		const templateId = readTemplatePartId(part);
		if (!templateId) return skip(null, "no-template");
		if (depth > MAX_TEMPLATE_PART_DEPTH) return skip(templateId, "too-deep");
		if (chain.includes(templateId)) return skip(templateId, "self-reference");

		const loaded = await loadOnce(templateId);
		if (!loaded.ok) return skip(templateId, "load-failed", loaded.error);
		const template = loaded.template;
		if (!template) return skip(templateId, "missing");
		if (!isTemplatePart(template.other)) return skip(templateId, "not-a-part");
		if (siteId === null || readTemplatePartSiteId(template.other) !== siteId) {
			return skip(templateId, "other-site");
		}

		used.set(templateId, toTimestamp(template.updatedAt));
		const copies = copyTemplateBlocks({
			templateBlocks: template.blocks,
			parentId: part.parentId ?? null,
			generateId: sequentialIds(part.id),
		});
		return resolveList(copies, depth + 1, [...chain, templateId]);
	};

	const resolveList = async (
		list: readonly BlockConfig[],
		depth: number,
		chain: readonly string[],
	): Promise<BlockConfig[]> => {
		const resolved = await Promise.all(
			list.map(async (block) => {
				if (isTemplatePartBlock(block)) return expandPart(block, depth, chain);
				if (!Array.isArray(block.children)) return [block];
				return [{ ...block, children: await resolveList(block.children, depth, chain) }];
			}),
		);
		return resolved.flat();
	};

	const resolvedBlocks = await resolveList(blocks, 1, []);
	const usedTemplates = [...used]
		.map(([id, updatedAt]) => ({ id, updatedAt }))
		.sort((a, b) => a.id.localeCompare(b.id));
	return { blocks: resolvedBlocks, usedTemplates };
}

/**
 * A text that changes whenever a linked template the page shows changes. The published-HTML cache
 * key includes it, so an edit to a header reaches every page on the next visit. Empty when the page
 * shows no parts, so pages without parts keep the keys they had before.
 */
export function templatePartsStamp(usedTemplates: readonly UsedTemplatePart[]): string {
	return usedTemplates
		.map((template) => `${template.id}@${template.updatedAt}`)
		.sort()
		.join(",");
}
