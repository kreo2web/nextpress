import { useState, type JSX } from "react";
import { Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MediaPickerDialog from "@/components/media/MediaPickerDialog";
import type { DocsSetupErrors, DocsSetupValues } from "./docs-setup-form";

type NameStepProps = {
	values: DocsSetupValues;
	errors: DocsSetupErrors;
	setValue: <K extends keyof DocsSetupValues>(key: K, value: DocsSetupValues[K]) => void;
	disabled: boolean;
};

/** Step 1: what the docs are called, and an optional logo from the media library. */
export function DocsSetupNameStep({ values, errors, setValue, disabled }: NameStepProps): JSX.Element {
	const [pickerOpen, setPickerOpen] = useState(false);
	const logo = values.logoUrl.trim();

	return (
		<div className="grid gap-6">
			<div className="grid gap-2">
				<Label htmlFor="docs-setup-name">Name</Label>
				<Input
					id="docs-setup-name"
					autoFocus
					autoComplete="off"
					value={values.name}
					placeholder="Acme Docs"
					disabled={disabled}
					aria-invalid={errors.name ? true : undefined}
					aria-describedby={errors.name ? "docs-setup-name-error" : "docs-setup-name-hint"}
					onChange={(event) => setValue("name", event.target.value)}
				/>
				{errors.name ? (
					<p id="docs-setup-name-error" role="alert" className="text-sm text-npb-status-error">
						{errors.name}
					</p>
				) : (
					<p id="docs-setup-name-hint" className="text-xs text-npb-text-muted">
						Shown at the top of every docs page.
					</p>
				)}
			</div>

			<div role="group" aria-labelledby="docs-setup-logo-label" className="grid gap-2">
				<span id="docs-setup-logo-label" className="text-sm leading-none font-medium">
					Logo <span className="font-normal text-npb-text-muted">(optional)</span>
				</span>
				<div className="flex flex-wrap items-center gap-3">
					<span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-npb-border-strong bg-npb-surface-inset text-npb-text-muted">
						{logo ? <img src={logo} alt="Your logo" className="size-full object-contain" /> : <ImageIcon aria-hidden className="size-5" />}
					</span>
					<Button type="button" variant="outline" disabled={disabled} onClick={() => setPickerOpen(true)}>
						{logo ? "Change logo" : "Choose logo"}
					</Button>
					{logo ? (
						<Button type="button" variant="ghost" disabled={disabled} onClick={() => setValue("logoUrl", "")}>
							Remove logo
						</Button>
					) : null}
				</div>
			</div>

			<MediaPickerDialog
				open={pickerOpen}
				onOpenChange={setPickerOpen}
				kind="image"
				onSelect={(item) => {
					setValue("logoUrl", item.url);
					setPickerOpen(false);
				}}
			/>
		</div>
	);
}
