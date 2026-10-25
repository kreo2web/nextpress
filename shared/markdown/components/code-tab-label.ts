import { codeLanguageLabel, resolveCodeLanguage } from "../code-languages.js";

/**
 * The name on a code group's tab: the code's title if it has one, else its language ("Shell"),
 * else "Code". One rule for the block and the MDX tag so a pasted group is labelled the same.
 */
export const codeTabLabel = ({ title, language }: { title?: string | null; language?: string | null }): string => {
	const named = title?.trim();
	if (named) return named;
	const resolved = resolveCodeLanguage(language);
	if (resolved && resolved !== "plaintext") return codeLanguageLabel(resolved);
	const typed = language?.trim();
	return typed && typed.toLowerCase() !== "plaintext" ? typed : "Code";
};

/** What groups share to stay in step: the tab names, in order. Groups with the same names switch together. */
export const codeGroupSyncKey = (labels: readonly string[]): string => labels.join("|");
