import { useState, type ReactElement } from "react";
import { BookOpen, Check, ChevronsUpDown, Plus } from "lucide-react";
import { DocsSetupModal } from "@/components/new-content";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSiteDocs } from "@/hooks/use-site-docs";
import { DocsNavigationSection } from "./DocsNavigationSection";
import { useRequiredDocsMode } from "./docs-mode-context";

/**
 * Which docs this page belongs to, with a menu to open another docs of the site or set up a new
 * one. A site can hold several docs (`/docs` and `/api`), and the editor never assumes there is one.
 */
function DocsPicker(): ReactElement {
	const { siteId, homeId, tree, openPage } = useRequiredDocsMode();
	const others = useSiteDocs({ siteId }).data ?? [];
	const [settingUp, setSettingUp] = useState(false);
	const name = tree ? tree.settings.title.trim() || tree.home.title : "Docs";

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button type="button" variant="ghost" className="h-auto w-full justify-between gap-2 px-2 py-2 text-left" aria-label={`${name}. Switch docs or set up new docs`}>
						<span className="flex min-w-0 items-center gap-2">
							<BookOpen className="h-4 w-4 shrink-0 text-npb-text-muted" aria-hidden />
							<span className="truncate text-sm font-semibold text-npb-text-primary">{name}</span>
						</span>
						<ChevronsUpDown className="h-4 w-4 shrink-0 text-npb-text-muted" aria-hidden />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-64">
					<DropdownMenuLabel className="text-xs font-medium text-npb-text-muted">Docs on this site</DropdownMenuLabel>
					{others.map((entry) => (
						<DropdownMenuItem key={entry.homeId} onSelect={() => openPage(entry.homeId)} className="gap-2">
							<span className="min-w-0 flex-1 truncate">{entry.name}</span>
							{entry.homeId === homeId ? <Check className="h-4 w-4 shrink-0" aria-label="Open now" /> : null}
						</DropdownMenuItem>
					))}
					<DropdownMenuSeparator />
					<DropdownMenuItem onSelect={() => setSettingUp(true)} className="gap-2">
						<Plus className="h-4 w-4" aria-hidden /> Set up new docs
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			{settingUp ? <DocsSetupModal onClose={() => setSettingUp(false)} /> : null}
		</>
	);
}

/** The left rail's Pages tab: the docs you are in, then its pages as a tree you open, add to and arrange. */
export function DocsPagesPanel(): ReactElement {
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="docs-pages-panel">
			<DocsPicker />
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6">
				<DocsNavigationSection />
			</div>
		</div>
	);
}
