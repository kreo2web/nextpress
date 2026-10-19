/**
 * Canonical block names accepted on page/post save.
 * The list lives in `shared/block-catalog/` so the editor, the server and the SDK share it.
 */
export {
	BLOCK_NAMES as KNOWN_BLOCK_NAMES,
	isBlockName as isKnownBlockName,
	type BlockName as KnownBlockName,
} from "./block-catalog/block-names.js";
