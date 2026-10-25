import { useCallback, useMemo, useRef, useState } from "react";
import type { DocsItemKind, DocsTreeItem } from "@shared/docs";
import { useToast } from "@/hooks/use-toast";
import { addDocsItem, deleteDocsItem, describeDocsFailure, reorderDocsItems, updateDocsItem } from "./docs-api";
import type { NavPlan } from "./docs-nav-model";
import type { DocsModeValue } from "./docs-mode-context";

type Failure = { atFunction: string; ids: Record<string, string>; message: string; title: string };

/**
 * Runs what the Navigation section decides: each change goes to the server, then the tree is read
 * again so the list and the canvas sidebar show what the server now holds. One change runs at a
 * time, because each plan was worked out from the tree as it was, and a second one made from the
 * same tree could undo the first.
 */
export function useDocsNavActions({ docs }: { docs: DocsModeValue }): {
	busy: boolean;
	add: (params: { title: string; kind: DocsItemKind; parentId: string; position?: number }) => Promise<DocsTreeItem | null>;
	rename: (params: { id: string; title: string }) => Promise<boolean>;
	run: (plan: NavPlan) => Promise<boolean>;
	remove: (params: { id: string }) => Promise<boolean>;
} {
	const { toast } = useToast();
	const [busy, setBusy] = useState(false);
	const running = useRef(false);
	const { homeId, pageId, refreshTree, syncAfterServerChange, setMeta, editor } = docs;

	/** Keeps the page being edited in step with what the server now says about its own row. */
	const takeServerRow = useCallback(
		async (item: DocsTreeItem): Promise<void> => {
			if (item.id !== pageId) return;
			setMeta({ title: item.title });
			editor.setDraft({ hidden: item.hidden });
			await syncAfterServerChange();
		},
		[editor, pageId, setMeta, syncAfterServerChange],
	);

	/** Runs one change; a failure is told in plain words and logged with what it was about. */
	const guarded = useCallback(
		async <T,>({ failure, work }: { failure: Failure; work: () => Promise<T> }): Promise<T | null> => {
			if (running.current) return null;
			running.current = true;
			setBusy(true);
			try {
				return await work();
			} catch (error) {
				const cause = error instanceof Error ? error : new Error(String(error));
				console.error({ atFunction: failure.atFunction, data: { ...failure.ids, homeId, pageId, error: cause }, message: failure.message });
				toast({ title: failure.title, description: describeDocsFailure(cause), variant: "destructive" });
				return null;
			} finally {
				running.current = false;
				setBusy(false);
				await refreshTree();
			}
		},
		[homeId, pageId, refreshTree, toast],
	);

	const add = useCallback<ReturnType<typeof useDocsNavActions>["add"]>(
		({ title, kind, parentId, position }) =>
			guarded({
				failure: { atFunction: "useDocsNavActions.add", ids: { parentId }, message: "A docs item was not added", title: kind === "group" ? "Couldn't add the group" : "Couldn't add the page" },
				work: () => addDocsItem({ homeId, input: { parentId, title, kind, ...(position !== undefined ? { position } : {}) } }),
			}),
		[guarded, homeId],
	);

	const run = useCallback<ReturnType<typeof useDocsNavActions>["run"]>(
		async (plan) => {
			if (plan.kind === "none") return false;
			const done = await guarded({
				failure: { atFunction: "useDocsNavActions.run", ids: { plan: plan.kind }, message: "A docs navigation change was not saved", title: "Couldn't make that change" },
				work: async () => {
					if (plan.kind === "reorder") {
						await reorderDocsItems({ homeId, input: { parentId: plan.parentId, orderedIds: plan.orderedIds } });
						return true;
					}
					if (plan.kind === "update") {
						await takeServerRow(await updateDocsItem({ pageId: plan.id, input: plan.input }));
						return true;
					}
					const moved = await updateDocsItem({ pageId: plan.id, input: { parentId: plan.parentId } });
					if (plan.orderedIds) await reorderDocsItems({ homeId, input: { parentId: plan.parentId, orderedIds: plan.orderedIds } });
					await takeServerRow(moved);
					return true;
				},
			});
			return done === true;
		},
		[guarded, homeId, takeServerRow],
	);

	const rename = useCallback<ReturnType<typeof useDocsNavActions>["rename"]>(
		async ({ id, title }) => {
			const done = await guarded({
				failure: { atFunction: "useDocsNavActions.rename", ids: { id }, message: "A docs page was not renamed", title: "Couldn't rename the page" },
				work: async () => {
					await takeServerRow(await updateDocsItem({ pageId: id, input: { title } }));
					return true;
				},
			});
			return done === true;
		},
		[guarded, takeServerRow],
	);

	const remove = useCallback<ReturnType<typeof useDocsNavActions>["remove"]>(
		async ({ id }) => {
			const done = await guarded({
				failure: { atFunction: "useDocsNavActions.remove", ids: { id }, message: "A docs page was not deleted", title: "Couldn't delete the page" },
				work: async () => {
					await deleteDocsItem({ pageId: id });
					return true;
				},
			});
			return done === true;
		},
		[guarded],
	);

	return useMemo(() => ({ busy, add, rename, run, remove }), [busy, add, rename, run, remove]);
}
