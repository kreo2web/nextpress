import type { ReactElement } from "react";
import type { BlockConfig } from "@shared/schema-types";
import { useBuilderWideLayout } from "../BuilderResponsiveSidebar";
import { DocsCompactSidebar } from "./DocsCompactSidebar";
import { DocsLibrarySidebar } from "./DocsLibrarySidebar";

type Props = {
	parentBlock: BlockConfig | null;
	updateBlock: (blockId: string, updates: Partial<BlockConfig>) => void;
	setHoverHighlight: (area: "padding" | "margin" | null) => void;
	onToggleSidebar: () => void;
};

/** Wide screens get the docs blocks on the left and the settings on the right; narrow ones get one rail with all four tabs. */
export function DocsResponsiveSidebar(props: Props): ReactElement {
	return useBuilderWideLayout() ? <DocsLibrarySidebar onToggleSidebar={props.onToggleSidebar} /> : <DocsCompactSidebar {...props} />;
}
