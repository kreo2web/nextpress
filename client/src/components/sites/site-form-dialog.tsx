import { useState, type JSX } from "react";
import { Globe } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DomainInputWithVerify } from "@/components/domain";

/** What the form hands back on save. A blank address means "no address". */
export type SiteFormValues = {
	name: string;
	siteUrl: string;
	description: string;
};

type SiteFormDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: "create" | "edit";
	initial?: Partial<SiteFormValues>;
	isSaving: boolean;
	onSubmit: (values: SiteFormValues) => void;
};

const COPY = {
	create: {
		title: "Add a site",
		description: "Each site has its own pages, media, settings and theme. Visitors reach it at its own address.",
		submit: "Create site",
		saving: "Creating…",
	},
	edit: {
		title: "Edit site",
		description: "Changing the address changes where visitors find this site.",
		submit: "Save changes",
		saving: "Saving…",
	},
} as const;

function SiteForm({
	mode,
	initial,
	isSaving,
	onSubmit,
	onCancel,
}: Omit<SiteFormDialogProps, "open" | "onOpenChange"> & { onCancel: () => void }): JSX.Element {
	const [values, setValues] = useState<SiteFormValues>({
		name: initial?.name ?? "",
		siteUrl: initial?.siteUrl ?? "",
		description: initial?.description ?? "",
	});
	const copy = COPY[mode];
	const hasName = values.name.trim().length > 0;

	return (
		<form
			className="contents"
			aria-busy={isSaving || undefined}
			onSubmit={(event) => {
				event.preventDefault();
				if (hasName && !isSaving) onSubmit(values);
			}}
		>
			<DialogHeader>
				<DialogTitle className="flex items-center gap-2 text-xl">
					<Globe className="h-5 w-5" aria-hidden />
					{copy.title}
				</DialogTitle>
				<DialogDescription>{copy.description}</DialogDescription>
			</DialogHeader>

			<div className="grid max-h-[60vh] gap-5 overflow-y-auto py-2 pr-1">
				<div className="grid gap-2">
					<Label htmlFor="site-form-name">
						Name <span className="text-red-500">*</span>
					</Label>
					<Input
						id="site-form-name"
						value={values.name}
						onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
						placeholder="Marketing site"
						autoFocus
						disabled={isSaving}
					/>
				</div>

				<div className="grid gap-1">
					<DomainInputWithVerify
						id="site-form-address"
						label="Address"
						inputMode="domain"
						value={values.siteUrl}
						onChange={(siteUrl) => setValues((current) => ({ ...current, siteUrl }))}
						placeholder="shop.example.com"
						disabled={isSaving}
					/>
					<p className="text-xs text-npb-text-muted">
						Optional. Point the domain at this server first. On your own computer you can use an address
						like site2.localhost:5000.
					</p>
				</div>

				{mode === "create" ? (
					<div className="grid gap-2">
						<Label htmlFor="site-form-description">Description</Label>
						<Textarea
							id="site-form-description"
							value={values.description}
							onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))}
							rows={3}
							disabled={isSaving}
						/>
					</div>
				) : null}
			</div>

			<DialogFooter>
				<Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
					Cancel
				</Button>
				<Button type="submit" disabled={!hasName || isSaving} title={!hasName ? "Give the site a name first" : undefined}>
					{isSaving ? copy.saving : hasName ? copy.submit : "Enter a name"}
				</Button>
			</DialogFooter>
		</form>
	);
}

/**
 * Add or edit a site. Mounts a fresh form each time it opens, so it always starts from the site's
 * current values; it can't be closed while a save is running.
 */
export function SiteFormDialog({ open, onOpenChange, mode, initial, isSaving, onSubmit }: SiteFormDialogProps): JSX.Element {
	return (
		<Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
			{open ? (
				<DialogContent
					className="max-w-lg"
					showCloseButton={!isSaving}
					onPointerDownOutside={(event) => {
						if (isSaving) event.preventDefault();
					}}
					onEscapeKeyDown={(event) => {
						if (isSaving) event.preventDefault();
					}}
				>
					<SiteForm
						mode={mode}
						initial={initial}
						isSaving={isSaving}
						onSubmit={onSubmit}
						onCancel={() => onOpenChange(false)}
					/>
				</DialogContent>
			) : null}
		</Dialog>
	);
}
