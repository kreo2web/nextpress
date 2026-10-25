import * as React from "react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { IconDrawingView, hasIconDrawing, readIconDrawingSource } from "../icon-drawing-view.js";
import { DEFAULT_STEP_ICON, type StepIcon } from "./steps-model.js";

type LucideExport = (typeof LucideIcons)[keyof typeof LucideIcons];

/** The library also exports helpers and lists; only an icon component carries React's `$$typeof` tag. */
const isIcon = (value: LucideExport): value is LucideIcon => typeof value === "object" && value !== null && "$$typeof" in value;

const toPascalCase = (name: string): string =>
	name
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("");

/**
 * A Lucide icon by its kebab-case name (`arrow-right`). Looks in the whole library, not its short
 * list of main names, so every name the icon picker offers (including old spellings such as
 * `check-circle`) is found. Undefined when there is no such icon.
 */
export function findLucideIcon(name: string): LucideIcon | undefined {
	const pascal = toPascalCase(name.trim());
	if (!pascal) return undefined;
	const found = LucideIcons[pascal as keyof typeof LucideIcons] ?? LucideIcons[`${pascal}Icon` as keyof typeof LucideIcons];
	return found !== undefined && isIcon(found) ? found : undefined;
}

/**
 * An icon name an author typed in MDX (`rocket`, `arrow-right`, also `ArrowRight`) as a step icon.
 * A missing or unknown name gives the check mark, so a step is never left with an empty circle.
 */
export function stepIconFromName(name: string | undefined): StepIcon {
	const kebab = (name ?? "").trim().replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase();
	return kebab && findLucideIcon(kebab) ? { ...DEFAULT_STEP_ICON, iconName: kebab } : { ...DEFAULT_STEP_ICON };
}

/** True when this icon can be drawn: a Lucide name that exists, or a saved drawing or picture. */
const canDraw = (icon: StepIcon): boolean =>
	icon.iconSet === "lucide" ? findLucideIcon(icon.iconName) !== undefined : hasIconDrawing(readIconDrawingSource(icon));

/**
 * One step's icon inside its marker circle. The same drawing rules as the Icon block: Lucide by
 * name, react-icons from the drawing saved when they were picked, brand logos and uploads from
 * their picture. The glyph box takes its size from the marker (`--np-steps-glyph`) and its colour
 * from the circle, like a number. An icon that cannot be drawn shows the check mark instead.
 */
export function StepIconView({ icon }: { icon: StepIcon }): React.ReactElement {
	const shown = canDraw(icon) ? icon : DEFAULT_STEP_ICON;
	const Glyph = shown.iconSet === "lucide" ? findLucideIcon(shown.iconName) : undefined;
	return (
		<span className="np-step__glyph">
			{Glyph ? (
				<Glyph size="100%" strokeWidth={shown.strokeWidth ?? 2} aria-hidden="true" />
			) : (
				<IconDrawingView icon={{ ...readIconDrawingSource(shown), label: undefined }} size="100%" />
			)}
		</span>
	);
}
