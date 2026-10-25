import type { PageOther } from "@shared/schema-types";
import type { DocsPageDraft } from "./docs-types";

type OtherSource = PageOther | null | undefined;

/** The description and the sidebar flag a saved page holds, as the Page tab edits them. */
export const readDocsPageDraft = (other: OtherSource): DocsPageDraft => ({
	description: typeof other?.seo?.metaDescription === "string" ? other.seo.metaDescription : "",
	hidden: other?.docs?.hidden === true,
});

/**
 * The page's `other` with the Page tab's edits put in, everything else kept. WHY the whole object:
 * a save replaces `other` as one value, so anything left out (design, icons, search settings) would
 * be lost. Only true flags are kept, as the server keeps them.
 */
export function mergeDocsPageOther({ existing, draft }: { existing: OtherSource; draft: DocsPageDraft }): PageOther {
	const base: PageOther = { ...(existing ?? {}) };
	const description = draft.description.trim();
	const { metaDescription: _old, ...seoRest } = base.seo ?? {};
	const seo = description ? { ...seoRest, metaDescription: description } : seoRest;
	const { hidden: _hidden, ...docsRest } = base.docs ?? {};
	const docs = draft.hidden ? { ...docsRest, hidden: true } : docsRest;

	const { seo: _seo, docs: _docs, ...rest } = base;
	return {
		...rest,
		...(Object.keys(seo).length > 0 ? { seo } : {}),
		...(Object.keys(docs).length > 0 ? { docs } : {}),
	};
}
