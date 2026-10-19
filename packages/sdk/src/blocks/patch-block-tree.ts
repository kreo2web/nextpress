/**
 * The block-tree patch engine now lives in `shared/page-tools/` so the editor, the server's
 * assistant and the SDK run one copy. This file keeps the SDK's public names.
 */
export {
	type BlockPatchOp,
	type PatchBlockTreeErr,
	type PatchBlockTreeOk,
	type PatchBlockTreeResult,
	patchBlockTree,
} from "./shared-page-tools.js";
