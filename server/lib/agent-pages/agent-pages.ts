import { blocksToMarkdown, extractPageText } from "@shared/content-text";
import { parsePageOther } from "@shared/page-other";
import type { BlockConfig } from "@shared/schema-types";

/** `path` is the page's full address without the leading slash (`guides/install`); a top-level page may leave it out. */
export type AgentPage = { title: string; slug: string; path?: string; blocks: BlockConfig[]; other?: object | null };

const DESCRIPTION_LENGTH = 140;

const pageBlocks = (page: AgentPage): BlockConfig[] => (Array.isArray(page.blocks) ? page.blocks : []);

/** The page's own description, or the start of its text. One line, no markup. */
export const describePage = (page: AgentPage): string => {
	const written = parsePageOther(page.other).seo?.metaDescription?.trim();
	const source = written || extractPageText(pageBlocks(page)).sections.find((section) => section.text.trim())?.text || "";
	const flat = source.replace(/\s+/g, " ").trim();
	return flat.length > DESCRIPTION_LENGTH ? `${flat.slice(0, DESCRIPTION_LENGTH).trimEnd()}…` : flat;
};

/** The page as markdown, with its title on top when the page's own text does not start with one. */
export const pageAsMarkdown = (page: AgentPage): string => {
	const body = blocksToMarkdown(pageBlocks(page));
	return /^# /.test(body) ? body : `# ${page.title}\n\n${body}`.trimEnd() + "\n";
};

/**
 * The `llms.txt` for a site: its name and description, then one line per page that points at the
 * page's markdown. Written for AI tools that read a site before answering questions about it.
 */
export const buildLlmsTxt = ({ siteName, siteDescription, pages }: { siteName: string; siteDescription: string; pages: AgentPage[] }): string => {
	const lines = pages.map((page) => {
		const description = describePage(page);
		return `- [${page.title}](/${page.path ?? page.slug}.md)${description ? `: ${description}` : ""}`;
	});
	return [`# ${siteName}`, siteDescription ? `\n> ${siteDescription}` : "", pages.length > 0 ? "\n## Pages\n" : "", ...lines, ""].filter((part) => part !== "").join("\n");
};
