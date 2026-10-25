import { createContext, useContext } from "react";
import { describeRootPage } from "@shared/blocks/bind-docs-shell";
import type { DocsPage } from "@shared/blocks/docs-layout-tree";
import { readDocsShellContent, type DocsShellContent } from "@shared/blocks/docs-shell-model";
import type { DocsTree } from "@shared/docs";
import { previewPagesFromTree } from "./docs-nav-model";
import type { DocsPageDraft, DocsPageMeta } from "./docs-types";

/**
 * What the canvas draws the docs frame from while the docs editor is open: the docs' own tree
 * (not every page of the site), the docs-wide settings and the page being edited as it is right
 * now, unsaved edits included. WHY: the sidebar, the title and the description on the canvas
 * must move as the Page tab and the Navigation section change them, not after a save.
 */
export type DocsCanvasSource = {
	pages: DocsPage[];
	/** The settings the shell inherits; null on the docs home, which holds its own. */
	rootShell: DocsShellContent | null;
	root: { id: string; title: string; path: string } | null;
	description: string;
};

const DocsCanvasSourceContext = createContext<DocsCanvasSource | null>(null);

export const DocsCanvasSourceProvider = DocsCanvasSourceContext.Provider;

/** Null outside the docs editor: the canvas then reads the site's pages itself. */
export const useDocsCanvasSource = (): DocsCanvasSource | null => useContext(DocsCanvasSourceContext);

type Params = { tree: DocsTree | null; pageId: string; isHome: boolean; meta: DocsPageMeta; draft: DocsPageDraft };

/** The page list with the page being edited replaced by its live title, address and sidebar flag. */
export function buildDocsCanvasSource({ tree, pageId, isHome, meta, draft }: Params): DocsCanvasSource {
	const live = (page: DocsPage): DocsPage => {
		const { hidden: _saved, ...rest } = page;
		return { ...rest, title: meta.title, slug: meta.slug || page.slug, ...(draft.hidden && !isHome ? { hidden: true } : {}) };
	};
	const pages = tree ? previewPagesFromTree(tree.home).map((page) => (page.id === pageId ? live(page) : page)) : [];
	const rootShell = tree && !isHome ? readDocsShellContent({ kind: "structured", data: { ...tree.settings, inherit: false } }) : null;
	return { pages, rootShell, root: pages.length > 0 ? describeRootPage({ pages, currentPageId: pageId }) : null, description: draft.description };
}
