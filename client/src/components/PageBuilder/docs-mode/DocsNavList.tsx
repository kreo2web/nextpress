import { Fragment, type ReactElement } from "react";
import type { DocsTreeItem } from "@shared/docs";
import { Draggable, Droppable } from "@/lib/dnd";
import { DocsNavRow } from "./DocsNavRow";
import { DocsNavRowMenu } from "./DocsNavRowMenu";
import type { NavPlan } from "./docs-nav-model";

/** Ids the editor's drag and drop sees for the navigation list: a list per parent, a draggable per row. */
export const NAV_LIST_PREFIX = "docs-nav:";
export const NAV_ROW_PREFIX = "docs-nav-row:";

type ListContext = {
	home: DocsTreeItem;
	currentId: string;
	collapsed: ReadonlySet<string>;
	renamingId: string | null;
	busy: boolean;
	onToggle: (id: string) => void;
	onOpen: (id: string) => void;
	onStartRename: (id: string) => void;
	onRename: (params: { id: string; title: string }) => void;
	onCancelRename: () => void;
	onRun: (plan: NavPlan) => void;
	onDelete: (item: DocsTreeItem) => void;
};

/** The thin line that shows where a dragged row will land. */
const DropLine = (): ReactElement => <li aria-hidden className="my-0.5 h-0.5 rounded bg-npb-accent" />;

/**
 * The rows under one parent, as a drop target of their own. WHY one list per parent: dropping
 * inside a list reorders it, and dropping in a group's list moves the row into that group, so the
 * list a row lands in is already the answer to "under which page".
 */
export function DocsNavList({ parent, depth, context }: { parent: DocsTreeItem; depth: number; context: ListContext }): ReactElement {
	return (
		<Droppable droppableId={`${NAV_LIST_PREFIX}${parent.id}`}>
			{(provided, snapshot) => (
				<ul ref={provided.innerRef} {...provided.droppableProps} className={depth > 0 ? "ml-4 border-l border-npb-divider pl-1" : undefined} role={depth === 0 ? "list" : undefined} aria-label={depth === 0 ? "Pages of the docs" : undefined}>
					{parent.children.map((child, index) => {
						const open = !context.collapsed.has(child.id);
						return (
							<Fragment key={child.id}>
								{snapshot.placeholderIndex === index ? <DropLine /> : null}
								<Draggable draggableId={`${NAV_ROW_PREFIX}${child.id}`} index={index} isDragDisabled={context.busy}>
									{(drag) => (
										<li ref={drag.innerRef} {...drag.draggableProps}>
											<DocsNavRow
												item={child}
												isCurrent={child.id === context.currentId}
												expanded={open}
												onToggleExpanded={() => context.onToggle(child.id)}
												onOpen={() => context.onOpen(child.id)}
												renaming={context.renamingId === child.id}
												onRename={(title) => context.onRename({ id: child.id, title })}
												onCancelRename={context.onCancelRename}
												dragHandleProps={drag.dragHandleProps}
												menu={
													<DocsNavRowMenu
														home={context.home}
														item={child}
														isCurrent={child.id === context.currentId}
														disabled={context.busy}
														onRename={() => context.onStartRename(child.id)}
														onOpen={() => context.onOpen(child.id)}
														onRun={context.onRun}
														onDelete={() => context.onDelete(child)}
													/>
												}
											/>
											{open && (child.children.length > 0 || child.kind === "group") ? <DocsNavList parent={child} depth={depth + 1} context={context} /> : null}
										</li>
									)}
								</Draggable>
							</Fragment>
						);
					})}
					{snapshot.placeholderIndex === parent.children.length ? <DropLine /> : null}
					{parent.children.length === 0 && parent.kind === "group" ? (
						<li className="px-2 py-1.5 text-xs text-npb-text-muted">{snapshot.isDraggingOver ? "Drop here to put it in this group" : "No pages in this group yet. Drag one here."}</li>
					) : null}
					{provided.placeholder}
				</ul>
			)}
		</Droppable>
	);
}
