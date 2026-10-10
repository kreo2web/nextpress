import { createContext, useContext, useMemo, type ReactNode } from "react";

const TemplatePartChainContext = createContext<readonly string[]>([]);

/**
 * The template ids already on the way down to this part: empty for a part on the page, and the
 * enclosing templates for a part shown inside one. The canvas uses it to stop a template from
 * showing itself, the same rule the server applies when it publishes.
 */
export function useTemplatePartChain(): readonly string[] {
	return useContext(TemplatePartChainContext);
}

/** Marks the template being shown as one more level down, for everything rendered inside it. */
export function TemplatePartChainProvider({
	templateId,
	children,
}: {
	templateId: string;
	children: ReactNode;
}) {
	const parent = useTemplatePartChain();
	const chain = useMemo(() => [...parent, templateId], [parent, templateId]);
	return <TemplatePartChainContext.Provider value={chain}>{children}</TemplatePartChainContext.Provider>;
}
