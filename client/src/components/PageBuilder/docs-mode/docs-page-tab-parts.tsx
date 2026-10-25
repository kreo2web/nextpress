import { useId, type ReactElement, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/** One field of the panel: the label above, the control, then a line of help or an error. */
export function PanelField({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: ReactNode; children: ReactNode }): ReactElement {
	return (
		<div className="space-y-1.5">
			<Label htmlFor={htmlFor} className="text-sm font-medium text-npb-text-secondary">
				{label}
			</Label>
			{children}
			{hint ? <p className="npb-settings-hint-muted text-xs">{hint}</p> : null}
		</div>
	);
}

type SwitchRowProps = {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	/** Plain words under the label: what it does, or why it can't be changed right now. */
	hint?: ReactNode;
	disabled?: boolean;
	className?: string;
};

/**
 * A label and a switch on one row. A disabled row always says why, in `hint`: a switch that can't
 * be turned and says nothing is a dead end.
 */
export function SwitchRow({ label, checked, onChange, hint, disabled = false, className }: SwitchRowProps): ReactElement {
	const id = useId();
	return (
		<div className={cn("space-y-1", className)}>
			<div className="flex items-center justify-between gap-3">
				<Label htmlFor={id} className={cn("text-sm font-medium text-npb-text-secondary", disabled && "opacity-70")}>
					{label}
				</Label>
				<Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} aria-describedby={hint ? `${id}-hint` : undefined} />
			</div>
			{hint ? (
				<p id={`${id}-hint`} className="npb-settings-hint-muted text-xs">
					{hint}
				</p>
			) : null}
		</div>
	);
}

/** A small text button that reads as a link inside a line of help. */
export function InlineAction({ onClick, children }: { onClick: () => void; children: ReactNode }): ReactElement {
	return (
		<button type="button" onClick={onClick} className="font-medium text-npb-text-secondary underline underline-offset-2 hover:text-npb-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-npb-focus">
			{children}
		</button>
	);
}
