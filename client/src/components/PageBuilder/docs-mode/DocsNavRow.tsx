import { useState, type KeyboardEvent, type ReactElement } from "react";
import { ChevronDown, ChevronRight, EyeOff, FileText, Folder, GripVertical, House } from "lucide-react";
import type { DocsTreeItem } from "@shared/docs";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DraggableProvided } from "@/lib/dnd";

type Props = {
	item: DocsTreeItem;
	isCurrent: boolean;
	isHome?: boolean;
	/** Only a row with rows under it (or a group) can fold. */
	expanded: boolean;
	onToggleExpanded: () => void;
	onOpen: () => void;
	renaming: boolean;
	onRename: (title: string) => void;
	onCancelRename: () => void;
	/** Not given for the docs home, which can't be dragged. */
	dragHandleProps?: DraggableProvided["dragHandleProps"];
	/** The row's menu button, drawn by the parent so this file stays about the row itself. */
	menu: ReactElement | null;
};

const statusLabel = (status: string): string | null => (status === "publish" ? null : status === "private" ? "Private" : "Draft");

/**
 * One row of the navigation list: drag grip, fold arrow, kind icon, title, small marks and the
 * menu. Clicking the title opens that page; renaming happens right in the row.
 */
export function DocsNavRow({ item, isCurrent, isHome = false, expanded, onToggleExpanded, onOpen, renaming, onRename, onCancelRename, dragHandleProps, menu }: Props): ReactElement {
	const [draft, setDraft] = useState(item.title);
	const foldable = item.children.length > 0 || item.kind === "group";
	const Icon = item.kind === "group" ? Folder : FileText;
	const status = statusLabel(item.status);

	const finish = (): void => {
		const next = draft.trim();
		if (next && next !== item.title) onRename(next);
		else onCancelRename();
	};
	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
		if (event.key === "Enter") finish();
		if (event.key === "Escape") onCancelRename();
	};

	return (
		<div
			className={cn(
				"group/row flex min-h-9 items-center gap-1 rounded-[var(--npb-radius-input)] pr-1 text-sm hover:bg-npb-interactive-bg-hover",
				isCurrent && "bg-npb-interactive-bg-active",
			)}
			data-current={isCurrent ? "true" : undefined}
		>
			{dragHandleProps ? (
				<button
					type="button"
					{...dragHandleProps}
					aria-label={`Drag ${item.title} to move it`}
					className="flex h-7 w-5 shrink-0 cursor-grab items-center justify-center text-npb-text-muted opacity-60 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-npb-focus active:cursor-grabbing"
				>
					<GripVertical className="h-3.5 w-3.5" aria-hidden />
				</button>
			) : (
				<span className="w-5 shrink-0" aria-hidden />
			)}
			{foldable ? (
				<button
					type="button"
					aria-label={`${expanded ? "Fold" : "Open"} ${item.title}`}
					aria-expanded={expanded}
					onClick={onToggleExpanded}
					className="flex h-7 w-5 shrink-0 items-center justify-center text-npb-text-muted hover:text-npb-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-npb-focus"
				>
					{expanded ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
				</button>
			) : (
				<span className="w-5 shrink-0" aria-hidden />
			)}
			<Icon className="h-4 w-4 shrink-0 text-npb-text-muted" aria-hidden />
			{renaming ? (
				<Input
					autoFocus
					aria-label={`New title for ${item.title}`}
					className="h-7 flex-1 px-2 text-sm"
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={onKeyDown}
					onBlur={finish}
				/>
			) : (
				<button
					type="button"
					onClick={onOpen}
					aria-current={isCurrent ? "page" : undefined}
					title={isCurrent ? "You are editing this page" : `Open ${item.title}`}
					className="min-w-0 flex-1 truncate rounded-sm px-1.5 py-1 text-left font-medium text-npb-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-npb-focus"
				>
					{item.title}
				</button>
			)}
			{/* The title keeps the room: the highlight already says which page is open, and a group is always a draft on purpose. */}
			{isHome ? <House className="h-3.5 w-3.5 shrink-0 text-npb-text-muted" aria-label="Docs home" role="img" /> : null}
			{item.hidden ? <EyeOff className="h-3.5 w-3.5 shrink-0 text-npb-text-muted" aria-label="Hidden from the sidebar" role="img" /> : null}
			{/* A dot, not a word, so the title keeps its room in the narrow rail; the word is in the tooltip and for screen readers. */}
			{status && item.kind !== "group" ? (
				<span className="mx-1 h-1.5 w-1.5 shrink-0 rounded-full bg-npb-status-warning" title={status}>
					<span className="sr-only">{status}</span>
				</span>
			) : null}
			{menu}
		</div>
	);
}
