import type { BlockContent } from "../schema-types.js";
import { type IconSetId, isIconSetId } from "../icon-types.js";
import { readChoice, readStructuredData, readText } from "./read-structured.js";

export const STEPS_BLOCK_NAME = "core/steps";
export const STEP_BLOCK_NAME = "core/step";

export const STEPS_LAYOUTS = ["vertical", "horizontal"] as const;
export type StepsLayout = (typeof STEPS_LAYOUTS)[number];
export const STEPS_MARKERS = ["number", "dot", "icon"] as const;
export type StepsMarker = (typeof STEPS_MARKERS)[number];

/**
 * A step's icon, saved exactly like the Icon block saves its own (`core/icon` → `icon`), so the
 * same picker fills it and the same drawing code paints it. Only the "icon" marker shows it; the
 * other markers keep it, so switching back to icons loses nothing. Its size and colour are the
 * marker's: the circle sizes the icon and colours it like a number. `svg`, `url`, `label` and
 * `tint` belong to one particular pick and may be `null`: saving merges into what is already
 * saved, so a new pick has to clear what the old one left behind.
 */
export type StepIcon = {
	iconSet: IconSetId;
	iconName: string;
	size?: number;
	color?: string;
	strokeWidth?: number;
	/** react-icons: the drawing saved when it was picked. */
	svg?: string | null;
	/** Brand logo or uploaded icon: the picture in the media library. */
	url?: string | null;
	label?: string | null;
	tint?: boolean | null;
};

/**
 * Numbered steps: a timeline down the page, or a row with arrows between steps (which turns
 * into the timeline on phones). Each child is a `core/step`.
 */
export type StepsContent = { layout: StepsLayout; marker: StepsMarker };
/** One step: its title (with the explanation as child blocks) and the icon the "icon" marker shows. */
export type StepContent = { title: string; icon: StepIcon };

export const DEFAULT_STEPS_CONTENT: StepsContent = { layout: "vertical", marker: "number" };
/** A check mark, in the Icon block's own default shape, so a step is never empty when icons are switched on. */
export const DEFAULT_STEP_ICON: StepIcon = { iconSet: "lucide", iconName: "check", size: 24, color: "currentColor", strokeWidth: 2 };
export const DEFAULT_STEP_CONTENT: StepContent = { title: "Step title", icon: { ...DEFAULT_STEP_ICON } };

/** What a saved icon may hold before it is checked: any field can be missing or the wrong type. */
type SavedIcon = { [key: string]: string | number | boolean | object | null | undefined };

const isSavedIcon = (value: SavedIcon[string]): value is SavedIcon => typeof value === "object" && value !== null && !Array.isArray(value);

const readFilled = (value: SavedIcon[string]): string | undefined => (typeof value === "string" && value !== "" ? value : undefined);

/**
 * A saved step icon, or the check mark when it is missing or unusable (an unknown icon set, no
 * name). Older saves and the AI may leave the set out; that means Lucide, as in the Icon block.
 */
export function readStepIcon(raw: SavedIcon[string]): StepIcon {
	if (!isSavedIcon(raw)) return { ...DEFAULT_STEP_ICON };
	const iconSet = raw.iconSet === undefined ? "lucide" : raw.iconSet;
	const iconName = readFilled(raw.iconName);
	if (!isIconSetId(iconSet) || !iconName) return { ...DEFAULT_STEP_ICON };
	const svg = readFilled(raw.svg);
	const url = readFilled(raw.url);
	const label = readFilled(raw.label);
	return {
		iconSet,
		iconName,
		size: typeof raw.size === "number" ? raw.size : DEFAULT_STEP_ICON.size,
		color: readFilled(raw.color) ?? DEFAULT_STEP_ICON.color,
		strokeWidth: typeof raw.strokeWidth === "number" ? raw.strokeWidth : DEFAULT_STEP_ICON.strokeWidth,
		...(svg ? { svg } : {}),
		...(url ? { url } : {}),
		...(label ? { label } : {}),
		...(raw.tint === true ? { tint: true } : {}),
	};
}

export function readStepsContent(content: BlockContent | undefined): StepsContent {
	const data = readStructuredData(content);
	return {
		layout: readChoice({ value: data.layout, options: STEPS_LAYOUTS, fallback: "vertical" }),
		marker: readChoice({ value: data.marker, options: STEPS_MARKERS, fallback: "number" }),
	};
}

export function readStepContent(content: BlockContent | undefined): StepContent {
	const data = readStructuredData(content);
	return { title: readText(data.title, DEFAULT_STEP_CONTENT.title), icon: readStepIcon(data.icon as SavedIcon[string]) };
}
