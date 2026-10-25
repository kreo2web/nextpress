import type { DocsPage } from "@shared/blocks/docs-layout-tree";
import type { DocsTreeItem, UpdateDocsItemInput } from "@shared/docs";

/**
 * Everything the Navigation section decides, as plain functions over the docs tree: which menu
 * entries make sense for a row, and exactly what to ask the server for. WHY apart from the
 * screen: the same plan serves the menu and dragging, and each rule can be tested without a page.
 */

/** What a menu choice or a drop asks the server to do. `none` carries the plain reason it can't. */
export type NavPlan =
	| { kind: "reorder"; parentId: string; orderedIds: string[] }
	/** Change the parent (the server puts the page last), then put it at `orderedIds` when that is not last. */
	| { kind: "move"; id: string; parentId: string; orderedIds: string[] | null }
	| { kind: "update"; id: string; input: UpdateDocsItemInput }
	| { kind: "none"; reason: string };

export type NavLocation = { item: DocsTreeItem; parent: DocsTreeItem; index: number };

/** The row, the row it sits under and its place there; null for the home or an id the tree doesn't hold. */
export function locateNavItem({ home, id }: { home: DocsTreeItem; id: string }): NavLocation | null {
	const search = (parent: DocsTreeItem): NavLocation | null => {
		for (const [index, item] of parent.children.entries()) {
			if (item.id === id) return { item, parent, index };
			const inner = search(item);
			if (inner) return inner;
		}
		return null;
	};
	return search(home);
}

/** Every row below `item`, nearest first. */
export const navDescendants = (item: DocsTreeItem): DocsTreeItem[] => item.children.flatMap((child) => [child, ...navDescendants(child)]);

/** The home first, then every row in sidebar order: for pickers and lists that show the whole tree. */
export const flattenNavTree = (home: DocsTreeItem): DocsTreeItem[] => [home, ...navDescendants(home)];

const none = (reason: string): NavPlan => ({ kind: "none", reason });

const ids = (items: DocsTreeItem[]): string[] => items.map((item) => item.id);

/** Where a row goes when it moves up (-1) or down (1) among its neighbours. */
function planShift({ home, id, step }: { home: DocsTreeItem; id: string; step: -1 | 1 }): NavPlan {
	const located = locateNavItem({ home, id });
	if (!located) return none("That page is no longer in these docs.");
	const target = located.index + step;
	if (target < 0) return none("It is already first.");
	if (target >= located.parent.children.length) return none("It is already last.");
	const order = ids(located.parent.children);
	[order[located.index], order[target]] = [order[target], order[located.index]];
	return { kind: "reorder", parentId: located.parent.id, orderedIds: order };
}

export const planMoveUp = ({ home, id }: { home: DocsTreeItem; id: string }): NavPlan => planShift({ home, id, step: -1 });
export const planMoveDown = ({ home, id }: { home: DocsTreeItem; id: string }): NavPlan => planShift({ home, id, step: 1 });

/** Put `id` under `parentId` at `position`; a position past the end (or none) means last. */
export function planMoveUnder({ home, id, parentId, position }: { home: DocsTreeItem; id: string; parentId: string; position?: number }): NavPlan {
	const moving = locateNavItem({ home, id });
	const target = parentId === home.id ? home : locateNavItem({ home, id: parentId })?.item;
	if (!moving || !target) return none("That page is no longer in these docs.");
	if (target.id === id || navDescendants(moving.item).some((below) => below.id === target.id)) return none("A page can't go under itself or a page inside it.");
	const others = ids(target.children).filter((childId) => childId !== id);
	const place = Math.max(0, Math.min(position ?? others.length, others.length));
	if (target.id === moving.parent.id) {
		if (place === moving.index) return none("It is already there.");
		return { kind: "reorder", parentId: target.id, orderedIds: [...others.slice(0, place), id, ...others.slice(place)] };
	}
	const orderedIds = place === others.length ? null : [...others.slice(0, place), id, ...others.slice(place)];
	return { kind: "move", id, parentId: target.id, orderedIds };
}

/** "Make it a sub-page of the row above": the neighbour before it becomes its parent. */
export function planMakeSubPage({ home, id }: { home: DocsTreeItem; id: string }): NavPlan {
	const located = locateNavItem({ home, id });
	if (!located) return none("That page is no longer in these docs.");
	const above = located.parent.children[located.index - 1];
	if (!above) return none("There is no row above it to go under.");
	return planMoveUnder({ home, id, parentId: above.id });
}

/** "Move out of its group": the page lands right after the group it left. */
export function planMoveOut({ home, id }: { home: DocsTreeItem; id: string }): NavPlan {
	const located = locateNavItem({ home, id });
	if (!located) return none("That page is no longer in these docs.");
	if (located.parent.id === home.id) return none("It is already at the top level.");
	const outer = locateNavItem({ home, id: located.parent.id });
	if (!outer) return none("That page is no longer in these docs.");
	return planMoveUnder({ home, id, parentId: outer.parent.id, position: outer.index + 1 });
}

/** The places a row can move to from its menu: the top level, and every group that isn't it, below it or already its parent. */
export function moveTargets({ home, id }: { home: DocsTreeItem; id: string }): DocsTreeItem[] {
	const located = locateNavItem({ home, id });
	if (!located) return [];
	const below = new Set(navDescendants(located.item).map((item) => item.id));
	const groups = navDescendants(home).filter((item) => item.kind === "group" && item.id !== id && !below.has(item.id));
	return [home, ...groups].filter((target) => target.id !== located.parent.id);
}

export const planMoveToGroup = ({ home, id, targetId }: { home: DocsTreeItem; id: string; targetId: string }): NavPlan =>
	planMoveUnder({ home, id, parentId: targetId });

export function planToggleHidden({ home, id }: { home: DocsTreeItem; id: string }): NavPlan {
	const located = locateNavItem({ home, id });
	if (!located) return none("That page is no longer in these docs.");
	return { kind: "update", id, input: { hidden: !located.item.hidden } };
}

/**
 * A row dropped after dragging: `toIndex` is where the list under `toParentId` showed the gap,
 * counted with the dragged row still in it (as the list does while dragging).
 */
export function planDrop({ home, id, toParentId, toIndex }: { home: DocsTreeItem; id: string; toParentId: string; toIndex: number }): NavPlan {
	const moving = locateNavItem({ home, id });
	const target = toParentId === home.id ? home : locateNavItem({ home, id: toParentId })?.item;
	if (!moving || !target) return none("That page is no longer in these docs.");
	const before = target.children.slice(0, toIndex).filter((child) => child.id !== id).length;
	return planMoveUnder({ home, id, parentId: toParentId, position: before });
}

/**
 * The pages a docs shows, as the sidebar builder takes them. WHY every page counts as open: the
 * canvas is where the docs are built, so a page you just added must be in the sidebar before it is
 * published. A group stays a label and a hidden page stays out, exactly as visitors will see them.
 */
export const previewPagesFromTree = (home: DocsTreeItem): DocsPage[] =>
	flattenNavTree(home).map((item) => ({
		id: item.id,
		title: item.title,
		slug: item.slug,
		parentId: item.parentId,
		menuOrder: item.menuOrder,
		status: "publish",
		...(item.kind === "group" ? { group: true } : {}),
		...(item.hidden ? { hidden: true } : {}),
	}));
