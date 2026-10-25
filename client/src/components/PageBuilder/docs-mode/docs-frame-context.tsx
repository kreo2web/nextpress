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
	isFrameBlock: (name: string) => boolean;
	/** True for the one frame block whose column takes blocks: the docs page. */
	takesBlocks: (name: string) => boolean;
	/** A click on the frame's top bar or sidebar: opens that part of the Docs tab. */
	openRegion: (region: DocsFrameRegion) => void;
};

const DocsFrameContext = createContext<DocsFrameValue | null>(null);

/** Kept apart from the rest of the docs state and given a stable value, so every canvas block can ask it cheaply. */
export function DocsFrameProvider({ openRegion, children }: { openRegion: (region: DocsFrameRegion) => void; children: ReactNode }): ReactElement {
	const value = useMemo<DocsFrameValue>(() => ({ isFrameBlock: isDocsFrameBlockName, takesBlocks, openRegion }), [openRegion]);
	return (
		<DocsFrameContext.Provider value={value}>
			<style dangerouslySetInnerHTML={{ __html: DOCS_FRAME_EDITOR_CSS }} />
			{children}
		</DocsFrameContext.Provider>
	);
}

/** Null outside the docs editor, where every block behaves as it always has. */
export const useDocsFrame = (): DocsFrameValue | null => useContext(DocsFrameContext);
