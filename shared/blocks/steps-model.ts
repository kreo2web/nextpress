import type { BlockContent } from "../schema-types.js";
import { readChoice, readStructuredData, readText } from "./read-structured.js";

export const STEPS_BLOCK_NAME = "core/steps";
export const STEP_BLOCK_NAME = "core/step";

export const STEPS_LAYOUTS = ["vertical", "horizontal"] as const;
export type StepsLayout = (typeof STEPS_LAYOUTS)[number];
export const STEPS_MARKERS = ["number", "dot"] as const;
export type StepsMarker = (typeof STEPS_MARKERS)[number];

/**
 * Numbered steps: a timeline down the page, or a row with arrows between steps (which turns
 * into the timeline on phones). Each child is a `core/step`.
 */
export type StepsContent = { layout: StepsLayout; marker: StepsMarker };
/** One step: its title, with the explanation as child blocks. */
export type StepContent = { title: string };

export const DEFAULT_STEPS_CONTENT: StepsContent = { layout: "vertical", marker: "number" };
export const DEFAULT_STEP_CONTENT: StepContent = { title: "Step title" };

export function readStepsContent(content: BlockContent | undefined): StepsContent {
	const data = readStructuredData(content);
	return {
		layout: readChoice({ value: data.layout, options: STEPS_LAYOUTS, fallback: "vertical" }),
		marker: readChoice({ value: data.marker, options: STEPS_MARKERS, fallback: "number" }),
	};
}

export function readStepContent(content: BlockContent | undefined): StepContent {
	return { title: readText(readStructuredData(content).title, DEFAULT_STEP_CONTENT.title) };
}
