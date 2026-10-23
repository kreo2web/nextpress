import type { BlockConfig } from "../schema-types.js";
import { readStackTypeFromContent } from "../stack-model.js";
import type { MergeResult } from "./merge-content.js";

const STACK_BLOCK_NAME = "core/stack";

const ONLY_IN_OVERLAY = "fillBehind only works on a layer directly inside a Stack whose stackType is overlay.";

/** True when the blocks directly inside `parent` are layers painted over each other. */
export const isOverlayStack = (parent: BlockConfig | null | undefined): boolean =>
	parent?.name === STACK_BLOCK_NAME && readStackTypeFromContent(parent.content) === "overlay";

/**
 * A block's settings with the editor's "Layer size: Fills behind" set, or left alone when the
 * agent did not say. A layer that fills behind covers the space the other layers make and never
 * makes it bigger, so a background picture or video stops setting the section's height.
 *
 * WHY not automatic: a picture with a small label on top should keep setting the size, and only
 * the agent knows which one it is building.
 */
export const withFillBehind = ({
	settings,
	parent,
	fillBehind,
}: {
	settings: BlockConfig["settings"];
	/** The block the layer sits in. */
	parent: BlockConfig | null | undefined;
	fillBehind: boolean | undefined;
}): MergeResult<BlockConfig["settings"]> => {
	if (fillBehind === undefined) return { ok: true, value: settings };
	if (!isOverlayStack(parent)) return { ok: false, message: ONLY_IN_OVERLAY };
	return { ok: true, value: { ...settings, stackFillBehind: fillBehind } };
};
