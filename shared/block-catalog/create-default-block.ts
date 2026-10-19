import type { BlockConfig } from "../schema-types.js";
import { newBlockOther } from "./content.js";
import { findBlockEntry } from "./entries.js";

/** Spacing every block gets when inserted, before its own defaults. */
export const INSERTED_BLOCK_BASE_STYLES = { padding: "20px 20px 0", margin: "0px" } as const;

type CreateDefaultBlockParams = {
	name: string;
	id: string;
	/** Makes ids for starting children (an accordion's first items). */
	newId: () => string;
};

/**
 * A new block exactly as the editor inserts it. The SDK and the AI builder use
 * the same function, so a block an agent adds looks like one a person adds.
 * Returns null for a name NextPress does not know.
 */
export const createDefaultBlock = ({ name, id, newId }: CreateDefaultBlockParams): BlockConfig | null => {
	const entry = findBlockEntry(name);
	if (!entry) return null;

	const block: BlockConfig = {
		id,
		name: entry.name,
		label: entry.label,
		type: entry.kind,
		parentId: null,
		category: entry.category,
		content: structuredClone(entry.defaultContent() ?? {}) as BlockConfig["content"],
		styles: { ...INSERTED_BLOCK_BASE_STYLES, ...entry.defaultStyles } as BlockConfig["styles"],
		settings: {},
		other: newBlockOther(),
	};

	if (entry.kind === "container") {
		block.children = entry.defaultChildren ? entry.defaultChildren({ parentId: id, newId }) : [];
	}

	return block;
};
