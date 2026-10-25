import { useQuery } from "@tanstack/react-query";
import { describeRootPage } from "@shared/blocks/bind-docs-shell";
import type { DocsPage } from "@shared/blocks/docs-layout-tree";
import { findDocsShell, readDocsShellContent, type DocsShellContent } from "@shared/blocks/docs-shell-model";
import type { BlockConfig } from "@shared/schema-types";
import { useDocsCanvasSource } from "../../docs-mode/docs-canvas-source";

type RootPageResponse = { blocks?: BlockConfig[] };

/**
 * The docs shell on the docs root page, for the editor's preview of an inheriting shell. Null
 * while loading, when this page is the root, or when the root has no shell yet. `root` is the page
 * the settings come from, for the "Set up on <page>" note.
 */
export function useRootShell({ pages, pageId }: { pages: DocsPage[]; pageId: string }): {
	rootShell: DocsShellContent | null;
	root: { id: string; title: string; path: string } | null;
} {
	const docsSource = useDocsCanvasSource();
	const root = pageId ? describeRootPage({ pages, currentPageId: pageId }) : null;
	const { data } = useQuery<RootPageResponse>({
		queryKey: [`/api/pages/${root?.id ?? ""}`],
		enabled: Boolean(root) && !docsSource,
		staleTime: 15_000,
	});
	// In the docs editor the docs-wide settings come with the docs' tree, so no second read of the home page.
	if (docsSource) return { rootShell: docsSource.rootShell, root };
	const shell = Array.isArray(data?.blocks) ? findDocsShell(data.blocks) : null;
	return { rootShell: shell ? readDocsShellContent(shell.content) : null, root };
}
