import type { ReactElement, ReactNode } from "react";
import { ArrowDown, ArrowUp, CornerLeftUp, CornerDownRight, Eye, EyeOff, FolderInput, MoreHorizontal, Pencil, Trash2, ArrowUpRight } from "lucide-react";
import type { DocsTreeItem } from "@shared/docs";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { locateNavItem, moveTargets, planMakeSubPage, planMoveDown, planMoveOut, planMoveToGroup, planMoveUp, planToggleHidden, type NavPlan } from "./docs-nav-model";

type Props = {
	home: DocsTreeItem;
	item: DocsTreeItem;
	isCurrent: boolean;
	disabled: boolean;
	onRename: () => void;
	onOpen: () => void;
	onRun: (plan: NavPlan) => void;
	onDelete: () => void;
	/** The docs home can be renamed and nothing else: it stays at the top as a page of the sidebar. */
	homeRow?: boolean;
};

/** An entry that can't be used says why next to its name, so a greyed row is never a mystery. */
function Entry({ icon, label, plan, onSelect }: { icon: ReactNode; label: string; plan: NavPlan; onSelect: () => void }): ReactElement {
	const blocked = plan.kind === "none";
	return (
		<DropdownMenuItem disabled={blocked} onSelect={onSelect}>
			{icon}
			<span className="flex-1">{label}</span>
			{blocked ? <span className="ml-3 text-xs text-npb-text-muted">{plan.reason}</span> : null}
		</DropdownMenuItem>
	);
}

/**
 * The menu on each row of the navigation list. What each entry would do is worked out in
 * `docs-nav-model`, so an entry is greyed, with its reason, exactly when its plan is "none".
 */
export function DocsNavRowMenu({ home, item, isCurrent, disabled, onRename, onOpen, onRun, onDelete, homeRow = false }: Props): ReactElement {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={disabled} aria-label={`More for ${item.title}`}>
					<MoreHorizontal className="h-4 w-4" aria-hidden />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-72">
				<DropdownMenuItem onSelect={onRename}>
					<Pencil className="h-4 w-4" aria-hidden />
					Rename
				</DropdownMenuItem>
				{isCurrent ? null : (
					<DropdownMenuItem onSelect={onOpen}>
						<ArrowUpRight className="h-4 w-4" aria-hidden />
						Open
					</DropdownMenuItem>
				)}
				{homeRow ? null : <DocsNavRowActions {...{ home, item, onRun, onDelete }} />}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** The entries that move, hide or delete a row (everything but Rename and Open). */
function DocsNavRowActions({ home, item, onRun, onDelete }: Pick<Props, "home" | "item" | "onRun" | "onDelete">): ReactElement {
	const located = locateNavItem({ home, id: item.id });
	const above = located?.parent.children[located.index - 1];
	const targets = moveTargets({ home, id: item.id });
	const hiddenPlan = planToggleHidden({ home, id: item.id });
	const noun = item.kind === "group" ? "group" : "page";
	return (
		<>
				<DropdownMenuSeparator />
				<Entry icon={<ArrowUp className="h-4 w-4" aria-hidden />} label="Move up" plan={planMoveUp({ home, id: item.id })} onSelect={() => onRun(planMoveUp({ home, id: item.id }))} />
				<Entry icon={<ArrowDown className="h-4 w-4" aria-hidden />} label="Move down" plan={planMoveDown({ home, id: item.id })} onSelect={() => onRun(planMoveDown({ home, id: item.id }))} />
				<Entry
					icon={<CornerDownRight className="h-4 w-4" aria-hidden />}
					label={above ? `Make it a sub-page of ${above.title}` : "Make it a sub-page of the row above"}
					plan={planMakeSubPage({ home, id: item.id })}
					onSelect={() => onRun(planMakeSubPage({ home, id: item.id }))}
				/>
				<Entry icon={<CornerLeftUp className="h-4 w-4" aria-hidden />} label="Move out of its group" plan={planMoveOut({ home, id: item.id })} onSelect={() => onRun(planMoveOut({ home, id: item.id }))} />
				{targets.length > 0 ? (
					<DropdownMenuSub>
						<DropdownMenuSubTrigger>
							<FolderInput className="h-4 w-4" aria-hidden />
							Move to another group
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent className="w-60">
							{targets.map((target) => (
								<DropdownMenuItem key={target.id} onSelect={() => onRun(planMoveToGroup({ home, id: item.id, targetId: target.id }))}>
									{target.id === home.id ? "Top level" : target.title}
								</DropdownMenuItem>
							))}
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				) : (
					<DropdownMenuItem disabled>
						<FolderInput className="h-4 w-4" aria-hidden />
						<span className="flex-1">Move to another group</span>
						<span className="ml-3 text-xs text-npb-text-muted">No group to move to</span>
					</DropdownMenuItem>
				)}
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={() => onRun(hiddenPlan)}>
					{item.hidden ? <Eye className="h-4 w-4" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />}
					{item.hidden ? "Show in sidebar" : "Hide from sidebar"}
				</DropdownMenuItem>
				<DropdownMenuItem onSelect={onDelete} className="text-npb-status-error focus:text-npb-status-error">
					<Trash2 className="h-4 w-4" aria-hidden />
					{`Delete ${noun}…`}
				</DropdownMenuItem>
		</>
	);
}
