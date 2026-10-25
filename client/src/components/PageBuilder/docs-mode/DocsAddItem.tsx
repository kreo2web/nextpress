import { useId, useState, type FormEvent, type ReactElement } from "react";
import { FilePlus, FolderPlus } from "lucide-react";
import type { DocsItemKind } from "@shared/docs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Props = {
	kind: DocsItemKind;
	disabled: boolean;
	/** Adds the item and tells whether it worked; the box closes only when it did. */
	onAdd: (title: string) => Promise<boolean>;
};

const WORDS: Record<DocsItemKind, { button: string; title: string; example: string; submit: string }> = {
	page: { button: "Page", title: "Title of the new page", example: "Install", submit: "Add page" },
	group: { button: "Group", title: "Name of the new group", example: "Getting started", submit: "Add group" },
};

/**
 * "+ Page" and "+ Group": a small box that asks for the title and nothing else. The page starts
 * empty; everything else about it is set afterwards, from the page itself.
 */
export function DocsAddItem({ kind, disabled, onAdd }: Props): ReactElement {
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("");
	const id = useId();
	const words = WORDS[kind];
	const Icon = kind === "group" ? FolderPlus : FilePlus;

	const submit = async (event: FormEvent): Promise<void> => {
		event.preventDefault();
		const clean = title.trim();
		if (!clean) return;
		if (await onAdd(clean)) {
			setTitle("");
			setOpen(false);
		}
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button type="button" variant="outline" size="sm" className="flex-1" disabled={disabled}>
					<Icon className="mr-1.5 h-4 w-4" aria-hidden />
					{words.button}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-72 space-y-3">
				<form onSubmit={submit} className="space-y-3">
					<label htmlFor={id} className="text-sm font-medium text-npb-text-secondary">
						{words.title}
					</label>
					<Input id={id} autoFocus value={title} placeholder={words.example} onChange={(event) => setTitle(event.target.value)} />
					<div className="flex justify-end gap-2">
						<Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button type="submit" size="sm" disabled={title.trim() === ""}>
							{words.submit}
						</Button>
					</div>
					{title.trim() === "" ? <p className="npb-settings-hint-muted text-xs">Type a title to add it.</p> : null}
				</form>
			</PopoverContent>
		</Popover>
	);
}
