import type { JSX, ReactNode } from "react";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { normalizeAddressPart, type DocsPlace } from "@/lib/docs/docs-address";
import { cn } from "@/lib/utils";
import { AddressReadiness } from "./address-readiness";
import type { DocsSetup } from "./use-docs-setup";

type WhereStepProps = {
	setup: Pick<DocsSetup, "values" | "errors" | "base" | "address" | "ownAddress" | "check" | "setPlace" | "setAddressPart">;
	disabled: boolean;
};

const isPlace = (value: string): value is DocsPlace => value === "this-site" || value === "own-address";

type PlaceOptionProps = {
	value: DocsPlace;
	title: string;
	description: string;
	selected: boolean;
	/** Why this option can't be picked, shown under its description. */
	unavailable?: string | null;
	children: ReactNode;
};

/** One way of placing the docs: a radio with its words, and its fields once it is picked. */
function PlaceOption({ value, title, description, selected, unavailable, children }: PlaceOptionProps): JSX.Element {
	const id = `docs-place-${value}`;
	const disabled = Boolean(unavailable);
	return (
		<div
			className={cn(
				"rounded-[var(--npb-radius-surface)] border transition-colors",
				selected ? "border-npb-accent bg-npb-surface-raised" : "border-npb-border-strong bg-npb-surface-base",
			)}
		>
			<label htmlFor={id} className={cn("flex gap-3 p-4", disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer")}>
				<RadioGroupItem id={id} value={value} disabled={disabled} className="mt-0.5" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} />
				<span className="grid min-w-0 gap-1">
					<span id={`${id}-title`} className="text-sm font-semibold text-npb-text-primary">
						{title}
					</span>
					<span id={`${id}-description`} className="text-sm text-npb-text-secondary">
						{description}
					</span>
					{unavailable ? <span className="text-xs text-npb-text-muted">{unavailable}</span> : null}
				</span>
			</label>
			{selected ? <div className="grid gap-3 px-4 pb-4 pl-11">{children}</div> : null}
		</div>
	);
}

type AddressFieldProps = {
	id: string;
	value: string;
	prefix?: string;
	suffix?: string;
	placeholder: string;
	error?: string;
	disabled: boolean;
	onChange: (text: string) => void;
	onBlur?: () => void;
};

/** The address box: the fixed part of the address sits beside the part people type. */
function AddressField({ id, value, prefix, suffix, placeholder, error, disabled, onChange, onBlur }: AddressFieldProps): JSX.Element {
	return (
		<div className="grid gap-1.5">
			<Label htmlFor={id}>Address</Label>
			<InputGroup>
				{prefix ? (
					<InputGroupAddon>
						<InputGroupText>{prefix}</InputGroupText>
					</InputGroupAddon>
				) : null}
				<InputGroupInput
					id={id}
					value={value}
					placeholder={placeholder}
					disabled={disabled}
					autoComplete="off"
					autoCapitalize="none"
					spellCheck={false}
					aria-invalid={error ? true : undefined}
					aria-describedby={error ? `${id}-error` : undefined}
					onChange={(event) => onChange(event.target.value)}
					onBlur={onBlur}
				/>
				{suffix ? (
					<InputGroupAddon align="inline-end">
						<InputGroupText>{suffix}</InputGroupText>
					</InputGroupAddon>
				) : null}
			</InputGroup>
			{error ? (
				<p id={`${id}-error`} role="alert" className="text-sm text-npb-status-error">
					{error}
				</p>
			) : null}
		</div>
	);
}

/** Step 2: under an address on this site, or on an address of their own. */
export function DocsSetupWhereStep({ setup, disabled }: WhereStepProps): JSX.Element {
	const { values, errors, base, address, ownAddress, check, setPlace, setAddressPart } = setup;
	const thisSite = values.place === "this-site";
	const recordName = base ? normalizeAddressPart(values.subdomain) : address.host;

	return (
		<RadioGroup
			value={values.place}
			aria-label="Where your docs live"
			disabled={disabled}
			onValueChange={(next) => isPlace(next) && setPlace(next)}
		>
			<PlaceOption
				value="this-site"
				title="On this site"
				description={`The docs open under an address on ${base || "this site"}, next to your other pages.`}
				selected={thisSite}
			>
				<AddressField
					id="docs-setup-path"
					value={values.path}
					prefix={base ? `${base}/` : "/"}
					placeholder="docs"
					error={errors.address}
					disabled={disabled}
					onChange={setAddressPart}
				/>
			</PlaceOption>
			<PlaceOption
				value="own-address"
				title="On a separate address"
				description={`Like docs.${base || "example.com"}, apart from your main site.`}
				selected={!thisSite}
				unavailable={ownAddress.reason}
			>
				<AddressField
					id="docs-setup-subdomain"
					value={values.subdomain}
					suffix={base ? `.${base}` : undefined}
					placeholder={base ? "docs" : "docs.example.com"}
					error={errors.address}
					disabled={disabled}
					onChange={setAddressPart}
					onBlur={check.run}
				/>
				<AddressReadiness state={check.state} host={address.host} recordName={recordName} onCheckAgain={check.run} />
			</PlaceOption>
		</RadioGroup>
	);
}
