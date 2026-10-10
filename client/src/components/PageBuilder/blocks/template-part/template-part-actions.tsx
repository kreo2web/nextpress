import { createContext, useContext, type ReactNode } from "react";
import type { BlockConfig } from "@shared/schema-types";

/**
 * What the builder can do with template parts. PageBuilder provides it. It is a separate context
 * from BlockActions so the feature can be removed without touching the block action contract.
 */
export type TemplatePartActions = {
	/** Adds a part that shows this template, at the end of the page content. */
	insertTemplatePart: (templateId: string) => void;
	/** Swaps one block for these blocks, in the same place (used by Detach). */
	replaceBlockWith: (blockId: string, blocks: BlockConfig[]) => void;
};

const TemplatePartActionsContext = createContext<TemplatePartActions | null>(null);

export function TemplatePartActionsProvider({
	value,
	children,
}: {
	value: TemplatePartActions;
	children: ReactNode;
}) {
	return (
		<TemplatePartActionsContext.Provider value={value}>{children}</TemplatePartActionsContext.Provider>
	);
}

/** The part actions, or null outside the page builder (for example in a test that renders one block). */
export function useTemplatePartActions(): TemplatePartActions | null {
	return useContext(TemplatePartActionsContext);
}
