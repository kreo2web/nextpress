import type { PageSeoSettings } from "@shared/schema-types";
import type { PostSearchText } from "../PageContext";

/**
 * The post's search settings with the Post tab's text laid over them. An emptied field is removed,
 * so search engines fall back to the title and subtitle again; everything else saved there stays.
 */
export function mergeSearchText({ saved, edited }: { saved: PageSeoSettings | undefined; edited: PostSearchText }): PageSeoSettings {
	const next: PageSeoSettings = { ...(saved ?? {}) };
	const title = edited.metaTitle?.trim() ?? "";
	const description = edited.metaDescription?.trim() ?? "";
	if (title) next.metaTitle = title;
	else delete next.metaTitle;
	if (description) next.metaDescription = description;
	else delete next.metaDescription;
	return next;
}
