import { blocksToMdx, mdxToBlocks } from "@shared/mdx-blocks";
import { parsePageOther } from "@shared/page-other";
import { isDocsPageBlocks, readDocsPageContent, replaceDocsPageContent } from "@shared/docs/docs-page-frame";
import type { DocsPageMdx, WriteDocsPageMdxInput } from "@shared/docs";
import { validateContentForSave } from "@shared/validate-content-save";
import type { Deps } from "../../routes/shared/deps";
import { savePageVersion } from "../save-page-version";
import { refuseDocs } from "./docs-refusal";
import { pageBlocks, type DocsPageRow } from "./docs-site-pages";

type MdxDeps = { models: Deps["models"]; hooks: Deps["hooks"]; newId: () => string };

const requireDocsPage = (page: DocsPageRow | undefined): DocsPageRow => {
	if (!page || !isDocsPageBlocks(pageBlocks(page))) {
		throw refuseDocs({ statusCode: 404, message: "That isn't a docs page. Open it from the docs editor or pick another page." });
	}
	return page;
};

/**
 * A docs page as MDX: the text agents read and write. Writing replaces only the page's own blocks
 * (never the docs frame) and goes through the one page save, so it gets a version and a history
 * entry like an editor save.
 */
export function createDocsMdx({ models, hooks, newId }: MdxDeps) {
	const readPage = async ({ page }: { page: DocsPageRow | undefined }): Promise<DocsPageMdx> => {
		const row = requireDocsPage(page);
		const { mdx, skipped } = blocksToMdx(readDocsPageContent(pageBlocks(row)));
		return {
			pageId: row.id,
			title: String(row.title),
			description: parsePageOther(row.other).seo?.metaDescription ?? "",
			mdx,
			version: row.version ?? 0,
			status: row.status ?? "draft",
			skipped,
		};
	};

	const writePage = async ({ page, input }: { page: DocsPageRow | undefined; input: WriteDocsPageMdxInput }): Promise<{ version: number }> => {
		const row = requireDocsPage(page);
		const parsed = mdxToBlocks({ text: input.mdx, newId });
		if (!parsed.ok) throw refuseDocs({ statusCode: 400, message: parsed.message, line: parsed.line });

		const other = parsePageOther(row.other);
		const nextOther = input.description !== undefined ? { ...other, seo: { ...other.seo, metaDescription: input.description.trim() } } : other;
		const validation = validateContentForSave({
			blocks: replaceDocsPageContent({ blocks: pageBlocks(row), children: parsed.blocks }),
			other: nextOther,
			contentType: "page",
		});
		if (!validation.ok) throw refuseDocs({ statusCode: 400, message: validation.error.message });

		const title = input.title?.trim();
		const saved = await savePageVersion({
			models,
			hooks,
			page: row,
			changes: {
				blocks: validation.blocks,
				...(input.description !== undefined ? { other: validation.other } : {}),
				...(title ? { title } : {}),
			},
			expectedVersion: input.expectedVersion,
		});
		return { version: saved.version ?? input.expectedVersion + 1 };
	};

	return { readPage, writePage };
}
