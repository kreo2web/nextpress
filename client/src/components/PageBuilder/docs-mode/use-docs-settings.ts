import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { findDocsShell } from "@shared/blocks/docs-shell-model";
import { readDocsSettings } from "@shared/docs/docs-page-frame";
import type { DocsSettings, DocsTree, UpdateDocsSettingsInput } from "@shared/docs";
import type { BlockConfig } from "@shared/schema-types";
import { useToast } from "@/hooks/use-toast";
import { describeDocsFailure, saveDocsSettings } from "./docs-api";
import { DOCS_TREE_KEY, refreshDocsTrees } from "./use-docs-tree";

type Params = {
	pageId: string;
	homeId: string;
	isHome: boolean;
	tree: DocsTree | null;
	blocks: BlockConfig[];
	updateBlock: (id: string, updates: Partial<BlockConfig>) => void;
};

/**
 * The docs-wide settings and the way to change them.
 *
 * On the docs home the settings are blocks of the page being edited, so a change goes into the
 * page like any other edit (undo works, Save keeps it). WHY not the settings route there: it
 * saves the home page behind the editor's back, and the editor's next Save would then be refused
 * as out of date. On every other page the settings belong to the home page, so the change goes to
 * the settings route and is saved at once.
 */
export function useDocsSettings({ pageId, homeId, isHome, tree, blocks, updateBlock }: Params): {
	settings: DocsSettings | null;
	saveSettings: (patch: UpdateDocsSettingsInput) => Promise<boolean>;
} {
	const queryClient = useQueryClient();
	const { toast } = useToast();
	const shell = useMemo(() => findDocsShell(blocks), [blocks]);
	const localSettings = useMemo(() => (isHome && shell ? readDocsSettings(blocks) : null), [blocks, isHome, shell]);
	const settings = localSettings ?? tree?.settings ?? null;

	const saveSettings = useCallback(
		async (patch: UpdateDocsSettingsInput): Promise<boolean> => {
			if (isHome && shell) {
				updateBlock(shell.id, { content: { kind: "structured", data: patch } });
				return true;
			}
			if (!homeId) return false;
			try {
				const saved = await saveDocsSettings({ homeId, patch });
				queryClient.setQueryData<DocsTree>([DOCS_TREE_KEY, pageId], (current) => (current ? { ...current, settings: saved } : current));
				await refreshDocsTrees({ queryClient });
				return true;
			} catch (error) {
				const failure = error instanceof Error ? error : new Error(String(error));
				console.error({ atFunction: "useDocsSettings.saveSettings", data: { pageId, homeId, fields: Object.keys(patch), error: failure }, message: "The docs settings were not saved" });
				toast({ title: "Couldn't save the docs settings", description: describeDocsFailure(failure), variant: "destructive" });
				return false;
			}
		},
		[homeId, isHome, pageId, queryClient, shell, toast, updateBlock],
	);

	return { settings, saveSettings };
}
