import { createContext, useContext } from "react";
import type { DocsPage } from "@shared/blocks/docs-layout-tree";
import type { DocsFeatures } from "@shared/blocks/docs-shell-model";

/**
 * What a docs page on the canvas needs from the shell around it: the site's pages and where the
 * sidebar starts. The shell provides it so the page draws exactly what the published page will.
 */
export type DocsEditorValue = { pages: DocsPage[]; pageId: string; rootPageId: string; description: string; features: DocsFeatures };

const DocsEditorContext = createContext<DocsEditorValue | null>(null);

export const DocsEditorProvider = DocsEditorContext.Provider;

export const useDocsEditor = (): DocsEditorValue | null => useContext(DocsEditorContext);
