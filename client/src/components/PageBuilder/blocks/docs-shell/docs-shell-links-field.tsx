import React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_DOCS_SHELL_LINKS, type DocsShellLink } from "@shared/blocks/docs-shell-model";
import { SettingsLabel } from "../../shared";

type LinksFieldProps = { blockId: string; links: DocsShellLink[]; onChange: (links: DocsShellLink[]) => void };

/** Up to six links for the top bar (GitHub, Blog…). Rows with an empty label or address are dropped when read. */
export function DocsShellLinksField({ blockId, links, onChange }: LinksFieldProps) {
	const update = (index: number, patch: Partial<DocsShellLink>) =>
		onChange(links.map((link, at) => (at === index ? { ...link, ...patch } : link)));
	return (
		<div className="space-y-2">
			<SettingsLabel>Links in the top bar</SettingsLabel>
			{links.map((link, index) => (
				<div key={index} className="flex items-center gap-2">
					<Input className="h-9" value={link.label} placeholder="GitHub" aria-label={`Link ${index + 1} text`} onChange={(event) => update(index, { label: event.target.value })} />
					<Input className="h-9" value={link.url} placeholder="https://" aria-label={`Link ${index + 1} address`} onChange={(event) => update(index, { url: event.target.value })} />
					<Button type="button" variant="ghost" size="icon" aria-label={`Remove link ${index + 1}`} onClick={() => onChange(links.filter((_, at) => at !== index))}>
						<X className="h-4 w-4" />
					</Button>
				</div>
			))}
			{links.length < MAX_DOCS_SHELL_LINKS ? (
				<Button type="button" variant="outline" size="sm" id={`docs-shell-add-link-${blockId}`} onClick={() => onChange([...links, { label: "", url: "" }])}>
					<Plus className="mr-1 h-4 w-4" />
					Add link
				</Button>
			) : (
				<p className="text-xs text-muted-foreground">The top bar holds up to {MAX_DOCS_SHELL_LINKS} links.</p>
			)}
		</div>
	);
}
