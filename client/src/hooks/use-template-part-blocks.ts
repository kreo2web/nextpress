import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { BlockConfig, Template } from "@shared/schema-types";
import { collectTemplatePartIds } from "@shared/template-parts";
import { readTemplateBlocks } from "@/lib/template-parts/read-template-blocks";
import type { TemplateBlocksById } from "@/lib/template-parts/splice-template-parts";

const useTemplateLevel = (templateIds: readonly string[]): (Template | undefined)[] =>
	useQueries({
		queries: templateIds.map((templateId) => ({
			queryKey: [`/api/templates/${templateId}`],
			staleTime: 0,
		})),
	}).map((result) => result.data as Template | undefined);

const nestedIds = (templates: readonly (Template | undefined)[], seen: readonly string[]): string[] =>
	collectTemplatePartIds(templates.flatMap((template) => (template ? readTemplateBlocks(template.blocks) : []))).filter(
		(id) => !seen.includes(id),
	);

/**
 * Fetches the templates that `blocks` show through linked parts, nested ones included (three levels,
 * the same limit as the published page), so the live preview can show them. One query hook per
 * level keeps the hook order stable; repeated keys are served from the cache.
 */
export function useTemplatePartBlocks(blocks: readonly BlockConfig[]): TemplateBlocksById {
	const firstIds = useMemo(() => collectTemplatePartIds(blocks), [blocks]);
	const first = useTemplateLevel(firstIds);
	const secondIds = nestedIds(first, firstIds);
	const second = useTemplateLevel(secondIds);
	const thirdIds = nestedIds(second, [...firstIds, ...secondIds]);
	const third = useTemplateLevel(thirdIds);

	const byId: Record<string, BlockConfig[]> = {};
	for (const template of [...first, ...second, ...third]) {
		if (template?.id) byId[template.id] = readTemplateBlocks(template.blocks);
	}
	return byId;
}
