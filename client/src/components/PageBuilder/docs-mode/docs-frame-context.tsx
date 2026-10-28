import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from "react";
import { DOCS_FRAME_EDITOR_CSS } from "./docs-frame-regions";
import type { DocsFrameRegion } from "./docs-types";

/**
 * The docs frame is page shell → docs shell → docs page. The docs editor draws all three exactly as
 * visitors see them and takes blocks only inside the docs page's content column, so these three
 * never get a toolbar, a pick, a drag or a drop.
 */
const FRAME_BLOCK_NAMES: ReadonlySet<string> = new Set(["core/page-shell", "docs/shell", "docs/page"]);

export const isDocsFrameBlockName = (name: string): boolean => FRAME_BLOCK_NAMES.has(name);

const takesBlocks = (name: string): boolean => name === "docs/page";

export type DocsFrameValue = {
	/** Drawn as visitors see it: no toolbar, pick, drag or drop. */
	isFrameBlock: (name: string) => boolean;
	/** Can be picked and typed in where it is, but never moved, copied or deleted (a post's title). */
	isFixed: (name: string) => boolean;
	/** True for the one frame block whose column takes blocks: the docs page. */
	takesBlocks: (name: string) => boolean;
	/** A click on the frame's top bar (Docs → Header) or on the sidebar around its links (the Pages tab). */
	openRegion: (region: DocsFrameRegion) => void;
	/** A click on a link of the frame (sidebar, breadcrumbs, previous/next): opens that page here. False when it isn't a page of these docs. */
	openLink: (href: string) => boolean;
};

const DocsFrameContext = createContext<DocsFrameValue | null>(null);

/** Kept apart from the rest of the docs state and given a stable value, so every canvas block can ask it cheaply. */
export function DocsFrameProvider({ openRegion, openLink, children }: Pick<DocsFrameValue, "openRegion" | "openLink"> & { children: ReactNode }): ReactElement {
	const value = useMemo<DocsFrameValue>(() => ({ isFrameBlock: isDocsFrameBlockName, isFixed: () => false, takesBlocks, openRegion, openLink }), [openLink, openRegion]);
	return (
		<DocsFrameContext.Provider value={value}>
			<style dangerouslySetInnerHTML={{ __html: DOCS_FRAME_EDITOR_CSS }} />
			{children}
		</DocsFrameContext.Provider>
	);
}

/**
 * The frame context for another editor with a fixed frame around one column that takes blocks (the
 * blog writing editor), so the canvas treats its frame as it treats the docs frame.
 */
export function FrameValueProvider({ value, children }: { value: DocsFrameValue; children: ReactNode }): ReactElement {
	return <DocsFrameContext.Provider value={value}>{children}</DocsFrameContext.Provider>;
}

/** Null outside the docs editor, where every block behaves as it always has. */
export const useDocsFrame = (): DocsFrameValue | null => useContext(DocsFrameContext);
