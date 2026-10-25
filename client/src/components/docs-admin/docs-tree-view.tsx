import type { JSX } from "react";
import { Link } from "wouter";
import { EyeOff, FileText, Folder } from "lucide-react";
import type { DocsTree, DocsTreeItem } from "@shared/docs";
import { docsPageEditorPath } from "@/lib/docs/docs-api";
import { formatContentStatus } from "@/lib/format-content-status";

/** Hidden pages are marked in words and an icon, not by colour alone. */
function HiddenMark(): JSX.Element {
	return (
		<span className="inline-flex items-center gap-1 rounded-full bg-npb-surface-inset px-2 py-0.5 text-xs text-npb-text-secondary">
			<EyeOff aria-hidden className="size-3" />
			Hidden
		</span>
	);
}

function PageRow({ item, isHome }: { item: DocsTreeItem; isHome: boolean }): JSX.Element {
	return (
		<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 py-1.5 text-sm">
			<FileText aria-hidden className="size-4 shrink-0 text-npb-text-muted" />
			<Link
				href={docsPageEditorPath(item.id)}
				className="min-w-0 truncate font-medium text-npb-text-primary hover:text-npb-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-npb-focus"
			>
				{item.title}
			</Link>
			{isHome ? <span className="text-xs text-npb-text-muted">Docs home</span> : <span className="truncate text-xs text-npb-text-muted">{item.path}</span>}
			{item.hidden ? <HiddenMark /> : null}
			{item.status !== "publish" ? <span className="text-xs text-npb-text-muted">{formatContentStatus(item.status)}</span> : null}
		</div>
	);
}

function GroupRow({ item }: { item: DocsTreeItem }): JSX.Element {
	return (
		<div className="flex min-w-0 items-center gap-2 py-1.5 text-sm">
			<Folder aria-hidden className="size-4 shrink-0 text-npb-text-muted" />
			<span className="min-w-0 truncate font-semibold text-npb-text-primary">{item.title}</span>
			<span className="text-xs text-npb-text-muted">Group</span>
			{item.hidden ? <HiddenMark /> : null}
		</div>
	);
}

function TreeItems({ items }: { items: DocsTreeItem[] }): JSX.Element | null {
	if (items.length === 0) return null;
	return (
		<ul className="ml-2 border-l border-npb-divider pl-3">
			{items.map((item) => (
				<li key={item.id}>
					{item.kind === "group" ? <GroupRow item={item} /> : <PageRow item={item} isHome={false} />}
					<TreeItems items={item.children} />
				</li>
			))}
		</ul>
	);
}

/**
 * The pages of one docs as a list, the way the sidebar groups them. Groups are labels, hidden pages
 * are marked, and each page opens in the editor. It only shows; changing the order happens in the editor.
 */
export function DocsTreeView({ tree }: { tree: DocsTree }): JSX.Element {
	return (
		<div>
			<PageRow item={tree.home} isHome />
			<TreeItems items={tree.home.children} />
		</div>
	);
}
