import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { useLocation } from "wouter";
import type { DocsItemKind, DocsTreeItem } from "@shared/docs";
import type { DropResult } from "@/lib/dnd";
import { pageEditorPath } from "@/lib/admin-content-routes";
import { DocsAddItem } from "./DocsAddItem";
import { DocsDeleteDialog } from "./DocsDeleteDialog";
import { DocsNavList, NAV_LIST_PREFIX, NAV_ROW_PREFIX } from "./DocsNavList";
import { DocsNavRow } from "./DocsNavRow";
import { DocsNavRowMenu } from "./DocsNavRowMenu";
import { locateNavItem, planDrop, type NavPlan } from "./docs-nav-model";
import { useRequiredDocsMode } from "./docs-mode-context";
import { useDocsNavActions } from "./use-docs-nav-actions";

/** What a drag from the list ended on: the parent whose list took the row, and the place in it. */
const readDrop = (result: DropResult): { id: string; toParentId: string; toIndex: number } | null => {
	if (!result.draggableId.startsWith(NAV_ROW_PREFIX) || !result.destination) return null;
	if (!result.destination.droppableId.startsWith(NAV_LIST_PREFIX)) return null;
	return {
		id: result.draggableId.slice(NAV_ROW_PREFIX.length),
		toParentId: result.destination.droppableId.slice(NAV_LIST_PREFIX.length),
		toIndex: result.destination.index,
	};
};

/**
 * The docs sidebar as a tree you edit here: add a page or a group, rename, move, hide, delete.
 * Pages are never added by dragging on the canvas, so every change to the sidebar happens in this
 * list, from a row's menu or by dragging a row inside the list.
 */
export function DocsNavigationSection(): ReactElement {
	const docs = useRequiredDocsMode();
	const { tree, treeLoading, treeFailed, pageId, homeId, dragBridge } = docs;
	const [, navigate] = useLocation();
	const actions = useDocsNavActions({ docs });
	const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [deleting, setDeleting] = useState<DocsTreeItem | null>(null);
	const home = tree?.home ?? null;

	const openPage = useCallback(
		(id: string): void => {
			if (id !== pageId) navigate(pageEditorPath(id));
		},
		[navigate, pageId],
	);
	const toggle = useCallback(
		(id: string): void =>
			setCollapsed((current) => {
				const next = new Set(current);
				if (!next.delete(id)) next.add(id);
				return next;
			}),
		[],
	);
	const rename = useCallback(
		({ id, title }: { id: string; title: string }): void => {
			setRenamingId(null);
			void actions.rename({ id, title });
		},
		[actions],
	);
	const run = useCallback((plan: NavPlan): void => void actions.run(plan), [actions]);

	// The editor's drag and drop belongs to the page builder; a drop that started in this list is handed back here.
	useEffect(() => {
		dragBridge.current = {
			handleDrop: (result) => {
				const drop = readDrop(result);
				if (!drop) return false;
				if (home) void actions.run(planDrop({ home, ...drop }));
				return true;
			},
			describe: (id) => (id.startsWith(NAV_ROW_PREFIX) && home ? (locateNavItem({ home, id: id.slice(NAV_ROW_PREFIX.length) })?.item.title ?? null) : null),
		};
		return () => {
			dragBridge.current = { handleDrop: null, describe: null };
		};
	}, [actions, dragBridge, home]);

	const listContext = useMemo(
		() =>
			home
				? { home, currentId: pageId, collapsed, renamingId, busy: actions.busy, onToggle: toggle, onOpen: openPage, onStartRename: setRenamingId, onRename: rename, onCancelRename: () => setRenamingId(null), onRun: run, onDelete: setDeleting }
				: null,
		[actions.busy, collapsed, home, openPage, pageId, rename, renamingId, run, toggle],
	);

	if (treeLoading) {
		return (
			<p className="text-sm text-npb-text-muted" role="status">
				Loading the pages…
			</p>
		);
	}
	if (treeFailed || !home || !listContext) {
		return (
			<p className="text-sm text-npb-text-muted" role="status">
				Couldn't load the pages of these docs. Reload the editor to try again.
			</p>
		);
	}

	/** New items go next to the page being edited: inside it when it is a group, else right after it. */
	const addTo = (kind: DocsItemKind) => async (title: string): Promise<boolean> => {
		const current = locateNavItem({ home, id: pageId });
		const intoGroup = current?.item.kind === "group" ? current.item : null;
		const parentId = intoGroup?.id ?? current?.parent.id ?? home.id;
		const position = intoGroup || !current ? undefined : current.index + 1;
		return (await actions.add({ title, kind, parentId, position })) !== null;
	};

	const confirmDelete = async (item: DocsTreeItem): Promise<void> => {
		setDeleting(null);
		const removed = await actions.remove({ id: item.id });
		if (removed && item.id === pageId) navigate(pageEditorPath(homeId));
	};

	return (
		<div className="space-y-3">
			<div className="flex gap-2">
				<DocsAddItem kind="page" disabled={actions.busy} onAdd={addTo("page")} />
				<DocsAddItem kind="group" disabled={actions.busy} onAdd={addTo("group")} />
			</div>
			<div className="-mx-1">
				<DocsNavRow
					item={home}
					isHome
					isCurrent={home.id === pageId}
					expanded={false}
					onToggleExpanded={() => undefined}
					onOpen={() => openPage(home.id)}
					renaming={renamingId === home.id}
					onRename={(title) => rename({ id: home.id, title })}
					onCancelRename={() => setRenamingId(null)}
					menu={
						<DocsNavRowMenu home={home} item={home} homeRow isCurrent={home.id === pageId} disabled={actions.busy} onRename={() => setRenamingId(home.id)} onOpen={() => openPage(home.id)} onRun={run} onDelete={() => undefined} />
					}
				/>
				<DocsNavList parent={home} depth={0} context={listContext} />
			</div>
			<p className="npb-settings-hint-muted text-xs">Drag a row by its grip to move it, or use its menu.</p>
			<DocsDeleteDialog item={deleting} onCancel={() => setDeleting(null)} onConfirm={(item) => void confirmDelete(item)} />
		</div>
	);
}
