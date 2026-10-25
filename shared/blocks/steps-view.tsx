import * as React from "react";
import type { ElementExtras } from "./view-attributes.js";
import { StepIconView } from "./step-icon-view.js";
import type { StepIcon, StepsLayout, StepsMarker } from "./steps-model.js";

/** The Steps wrapper and its list; the same markup for the Steps block and the MDX `<Steps>` tag. Items go in as children. */
export function StepsView({
	layout,
	marker,
	className,
	style,
	attributes,
	children,
}: ElementExtras & { layout: StepsLayout; marker: StepsMarker; children?: React.ReactNode }): React.ReactElement {
	return (
		<div
			className={["wp-block-steps", `np-steps--${layout}`, `np-steps--${marker}`, className].filter(Boolean).join(" ")}
			style={style}
			{...attributes}
		>
			<ol className="np-steps__items">{children}</ol>
		</div>
	);
}

/**
 * The marker circle of a step whose Steps use the "icon" marker. Number and dot markers are
 * drawn by the stylesheet alone; only an icon needs an element. The editor canvas draws this
 * same piece, so the circle is one markup in the editor and on the page.
 */
export function StepMarkerView({ icon }: { icon: StepIcon }): React.ReactElement {
	return (
		<span className="np-step__icon" aria-hidden="true">
			<StepIconView icon={icon} />
		</span>
	);
}

/**
 * One step. Steps draws its steps as list items; a step found anywhere else keeps the same
 * classes on a plain div, so it still looks like a step. Pass `icon` only when the Steps use
 * the "icon" marker.
 */
export function StepItemView({
	as,
	title,
	icon,
	className,
	style,
	attributes,
	children,
}: ElementExtras & { as: "li" | "div"; title: string; icon?: StepIcon; children?: React.ReactNode }): React.ReactElement {
	const Tag = as;
	return (
		<Tag className={["wp-block-step", className].filter(Boolean).join(" ")} style={style} {...attributes}>
			{icon ? <StepMarkerView icon={icon} /> : null}
			<h3 className="np-step__title">{title}</h3>
			<div className="np-step__body">{children}</div>
		</Tag>
	);
}

/** Something that isn't a step, dropped into Steps: it still shows, in its place. */
export function StepsOtherView({ children }: { children?: React.ReactNode }): React.ReactElement {
	return (
		<li className="np-steps__other" style={{ listStyle: "none" }}>
			{children}
		</li>
	);
}
