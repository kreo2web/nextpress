import type { JSX } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { DocsSetupValues } from "./docs-setup-form";

type FeatureKey = "search" | "sidebar" | "toc" | "prevNext" | "copyPage";

const FEATURES: { key: FeatureKey; label: string; hint: string }[] = [
	{ key: "search", label: "Search", hint: "A search box at the top of every page." },
	{ key: "sidebar", label: "Sidebar", hint: "Your pages as a list on the left." },
	{ key: "toc", label: "On this page", hint: "A short list of the page's headings on the right." },
	{ key: "prevNext", label: "Previous / next", hint: "Links to the page before and the page after." },
	{ key: "copyPage", label: "Copy page", hint: "A button that copies the page as text." },
];

type FeaturesStepProps = {
	values: DocsSetupValues;
	setValue: <K extends keyof DocsSetupValues>(key: K, value: DocsSetupValues[K]) => void;
	disabled: boolean;
};

/** Step 3: the five switches, all on to start with. */
export function DocsSetupFeaturesStep({ values, setValue, disabled }: FeaturesStepProps): JSX.Element {
	return (
		<ul className="divide-y divide-npb-divider rounded-[var(--npb-radius-surface)] border border-npb-border-strong bg-npb-surface-base">
			{FEATURES.map(({ key, label, hint }) => (
				<li key={key} className="flex items-start justify-between gap-4 p-4">
					<div className="grid gap-1">
						<Label htmlFor={`docs-feature-${key}`}>{label}</Label>
						<p id={`docs-feature-${key}-hint`} className="text-xs text-npb-text-muted">
							{hint}
						</p>
					</div>
					<Switch
						id={`docs-feature-${key}`}
						checked={values[key]}
						disabled={disabled}
						aria-describedby={`docs-feature-${key}-hint`}
						onCheckedChange={(checked) => setValue(key, checked)}
					/>
				</li>
			))}
		</ul>
	);
}
