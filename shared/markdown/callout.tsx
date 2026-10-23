import type { JSX, ReactNode } from "react";

export const CALLOUT_TYPES = ["note", "tip", "warning", "danger", "success"] as const;
export type CalloutType = (typeof CALLOUT_TYPES)[number];

/** Lucide icon paths (ISC), inlined so shared code needs no icon package. */
const ICON_PATHS: Record<CalloutType, readonly string[]> = {
	note: ["M12 16v-4", "M12 8h.01", "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z"],
	tip: ["M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5", "M9 18h6", "M10 22h4"],
	warning: ["m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3", "M12 9v4", "M12 17h.01"],
	danger: ["M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z", "m15 9-6 6", "m9 9 6 6"],
	success: ["M21.801 10A10 10 0 1 1 17 3.335", "m9 11 3 3L22 4"],
};

/** Read out before the callout's text, so a screen reader hears what kind of note it is. */
const SPOKEN_LABEL: Record<CalloutType, string> = {
	note: "Note",
	tip: "Tip",
	warning: "Warning",
	danger: "Danger",
	success: "Success",
};

/** Any other value an author types is shown as a note. */
export const readCalloutType = (value: string | null | undefined): CalloutType =>
	CALLOUT_TYPES.find((type) => type === value) ?? "note";

/** A highlighted note in a page: `<Callout type="warning" title="Back up first">…</Callout>` in MDX. */
export function Callout({ type, title, children }: { type?: string | null; title?: string | null; children?: ReactNode }): JSX.Element {
	const kind = readCalloutType(type);
	return (
		<aside className="np-callout" data-type={kind}>
			<svg className="np-callout-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
				{ICON_PATHS[kind].map((path) => (
					<path key={path} d={path} />
				))}
			</svg>
			<div className="np-callout-body">
				<span className="np-visually-hidden">{`${SPOKEN_LABEL[kind]}: `}</span>
				{title ? <p className="np-callout-title">{title}</p> : null}
				{children}
			</div>
		</aside>
	);
}
