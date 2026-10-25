import { useState, type ReactElement } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { MAX_DOCS_SHELL_LINKS, type DocsShellLink } from "@shared/blocks/docs-shell-model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SettingsLabel } from "../shared";

type Props = {
	links: DocsShellLink[];
	/** Called with the links that have both a name and an address (the only ones the top bar shows). */
	onChange: (links: DocsShellLink[]) => void;
	/** True when each keystroke is a cheap local edit; false when each change is a save, so text waits for the box to lose focus. */
	live?: boolean;
};

const complete = (rows: DocsShellLink[]): DocsShellLink[] =>
	rows.map((row) => ({ label: row.label.trim(), url: row.url.trim() })).filter((row) => row.label !== "" && row.url !== "");

const sameLinks = (a: DocsShellLink[], b: DocsShellLink[]): boolean => a.length === b.length && a.every((link, at) => link.label === b[at].label && link.url === b[at].url);

/**
 * Up to six links for the top bar, each with a name and an address, in the order they show.
 * WHY the rows are kept here: a row with only one of the two is not a link yet and the top bar
 * leaves it out, so it can't be saved, but the person is still typing it.
 */
export function DocsLinksField({ links, onChange, live = false }: Props): ReactElement {
	const [rows, setRows] = useState<DocsShellLink[]>(links);
	const [seen, setSeen] = useState<DocsShellLink[]>(links);
	if (!sameLinks(seen, links)) {
		setSeen(links);
		if (!sameLinks(complete(rows), links)) setRows(links);
	}

	const push = (next: DocsShellLink[]): void => {
		setRows(next);
		const ready = complete(next);
		if (!sameLinks(ready, links)) onChange(ready);
	};
	const edit = (index: number, patch: Partial<DocsShellLink>): DocsShellLink[] => rows.map((row, at) => (at === index ? { ...row, ...patch } : row));
	const move = (index: number, step: -1 | 1): void => {
		const next = [...rows];
		[next[index], next[index + step]] = [next[index + step], next[index]];
		push(next);
	};
	const full = rows.length >= MAX_DOCS_SHELL_LINKS;

	return (
		<div className="space-y-2">
			<div className="flex items-baseline justify-between">
				<SettingsLabel>Links</SettingsLabel>
				<span className="text-xs text-npb-text-muted">
					{rows.length} of {MAX_DOCS_SHELL_LINKS}
				</span>
			</div>
			{rows.length > 0 ? (
				<ul className="divide-y divide-npb-divider rounded-[var(--npb-radius-surface)] border border-npb-border-default">
					{rows.map((row, index) => {
						const half = (row.label.trim() === "") !== (row.url.trim() === "");
						return (
							<li key={index} className="space-y-1.5 p-2">
								<div className="flex items-center gap-1">
									<Input
										className="h-8"
										value={row.label}
										placeholder="Name, for example GitHub"
										aria-label={`Link ${index + 1} name`}
										onChange={(event) => (live ? push(edit(index, { label: event.target.value })) : setRows(edit(index, { label: event.target.value })))}
										onBlur={() => push(rows)}
									/>
									<Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Move link ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>
										<ArrowUp className="h-3.5 w-3.5" aria-hidden />
									</Button>
									<Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Move link ${index + 1} down`} disabled={index === rows.length - 1} onClick={() => move(index, 1)}>
										<ArrowDown className="h-3.5 w-3.5" aria-hidden />
									</Button>
									<Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Remove link ${index + 1}`} onClick={() => push(rows.filter((_, at) => at !== index))}>
										<X className="h-3.5 w-3.5" aria-hidden />
									</Button>
								</div>
								<Input
									className="h-8"
									value={row.url}
									placeholder="Address, for example https://github.com/you/app"
									aria-label={`Link ${index + 1} address`}
									onChange={(event) => (live ? push(edit(index, { url: event.target.value })) : setRows(edit(index, { url: event.target.value })))}
									onBlur={() => push(rows)}
								/>
								{half ? <p className="npb-settings-hint-muted text-xs">Add both a name and an address to show this link.</p> : null}
							</li>
						);
					})}
				</ul>
			) : null}
			<Button type="button" variant="outline" size="sm" disabled={full} onClick={() => setRows([...rows, { label: "", url: "" }])}>
				<Plus className="mr-1 h-4 w-4" aria-hidden />
				Add a link
			</Button>
			{full ? <p className="npb-settings-hint-muted text-xs">The top bar holds up to {MAX_DOCS_SHELL_LINKS} links.</p> : null}
		</div>
	);
}
