import type { JSX, ReactNode } from "react";

export type ParamViewProps = {
	name: string;
	type?: string;
	/** Shown as "Default: …" when the option isn't required. */
	defaultValue?: string;
	required?: boolean;
	/** The description, already drawn. */
	children?: ReactNode;
};

/**
 * One documented option: name, type, "Required" or its default, then what it does. Pure and
 * hook-free. Next to another `.np-param` it joins it into one list (CSS), so MDX needs no wrapper.
 */
export function ParamView({ name, type, defaultValue, required = false, children }: ParamViewProps): JSX.Element {
	return (
		<div className="np-param">
			<div className="np-param-head">
				<code className="np-param-name">{name}</code>
				{type ? <span className="np-param-type">{type}</span> : null}
				{required ? <span className="np-param-flag">Required</span> : null}
				{!required && defaultValue ? <span className="np-param-default">{`Default: ${defaultValue}`}</span> : null}
			</div>
			{children ? <div className="np-param-body">{children}</div> : null}
		</div>
	);
}
