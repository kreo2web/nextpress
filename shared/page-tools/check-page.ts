import { findBlockEntry } from "../block-catalog/entries.js";
import { PAGE_SHELL_BLOCK_NAME } from "../page-shell-model.js";
import type { BlockConfig } from "../schema-types.js";
import { validateBlockResponsiveHealth } from "../validate-block-responsive-health.js";
import { validateContentForSave } from "../validate-content-save.js";
import {
	checkBlockStructure,
	DUPLICATE_BLOCK_ID,
	INVALID_BLOCK_STRUCTURE,
	INVALID_BLOCK_TYPE,
	UNKNOWN_BLOCK,
} from "./check-block-structure.js";
import { findBlockById, walkBlocks } from "./tree-find.js";

export type PageProblemKind = "structure" | "save" | "placement" | "phone";

export type PageProblem = {
	kind: PageProblemKind;
	blockId?: string;
	/** Plain words, for a model or a person. */
	message: string;
	/** What to do about it, when there is an obvious step. */
	fix?: string;
};

export type CheckPageResult = {
	/** False when the server would refuse the page or the page breaks a placement rule. Phone problems never turn it false. */
	ok: boolean;
	problems: PageProblem[];
};

const STRUCTURE_FIXES: Record<string, string> = {
	[UNKNOWN_BLOCK]: "Use a name from list_block_types.",
	[DUPLICATE_BLOCK_ID]: "Give each block its own id.",
	[INVALID_BLOCK_TYPE]: "Insert the block through change_blocks so it gets the right type.",
	[INVALID_BLOCK_STRUCTURE]: "Keep children only inside container blocks, and content as an object.",
};

const structureProblems = (blocks: BlockConfig[]): PageProblem[] => {
	const result = checkBlockStructure(blocks);
	if (result.ok) return [];
	return result.issues.map((issue) => ({
		kind: "structure",
		blockId: issue.blockId,
		message: issue.message,
		fix: STRUCTURE_FIXES[issue.code],
	}));
};

/** The server stops at the first save problem, so at most one comes back. */
const saveProblems = ({
	blocks,
	contentType,
	structure,
}: {
	blocks: BlockConfig[];
	contentType: "page" | "post";
	structure: PageProblem[];
}): PageProblem[] => {
	const result = validateContentForSave({ blocks: structuredClone(blocks), contentType });
	if (result.ok) return [];
	const { code, message, blockId } = result.error;
	const alreadyReported = code === UNKNOWN_BLOCK && structure.some((problem) => problem.blockId === blockId);
	return alreadyReported
		? []
		: [{ kind: "save", blockId, message: `The server would refuse to save this page: ${message}`, fix: "Fix or remove that block." }];
};

/**
 * The save rules for single blocks, each checked on its own (without its children).
 *
 * WHY: the server stops at the first save problem it meets, so one old problem can hide a
 * new one behind it. Checking each block alone finds the new one anyway. Unknown block names
 * are left to the structure check.
 */
export const checkBlocksOnTheirOwn = ({
	blocks,
	ids,
	contentType = "page",
}: {
	blocks: BlockConfig[];
	ids: Iterable<string>;
	contentType?: "page" | "post";
}): PageProblem[] =>
	[...ids].flatMap((id) => {
		const block = findBlockById({ blocks, id });
		if (!block || !findBlockEntry(block.name)) return [];
		return saveProblems({ blocks: [{ ...block, children: undefined }], contentType, structure: [] });
	});

const placementProblems = (blocks: BlockConfig[]): PageProblem[] => {
	const problems: PageProblem[] = [];
	const shells: BlockConfig[] = [];
	walkBlocks({
		blocks,
		visit: (block, depth) => {
			if (block.name === PAGE_SHELL_BLOCK_NAME) shells.push(block);
			if (depth > 0 && findBlockEntry(block.name)?.placement?.rootOnly) {
				problems.push({
					kind: "placement",
					blockId: block.id,
					message: `${block.name} can only sit at the page root, not inside another block.`,
					fix: "Move it to the page root (parentId null).",
				});
			}
		},
	});
	// A shell below the root is already reported above; only report extra shells at the root.
	const reported = new Set(problems.map((problem) => problem.blockId));
	problems.push(
		...shells
			.slice(1)
			.filter((shell) => !reported.has(shell.id))
			.map((shell) => ({
				kind: "placement" as const,
				blockId: shell.id,
				message: "A page has only one page shell, and this is an extra one.",
				fix: "Delete the extra shell and keep its blocks inside the first one.",
			})),
	);
	return problems;
};

const phoneProblems = (blocks: BlockConfig[]): PageProblem[] =>
	validateBlockResponsiveHealth(blocks).issues.map((issue) => ({
		kind: "phone",
		blockId: issue.blockId,
		message: issue.message,
		fix: issue.fix ? `${issue.fix.label} (apply_phone_fixes does this for every such block).` : undefined,
	}));

/**
 * Everything that can be wrong with a page, in one list: the tree structure, the rules the
 * server enforces on save (the same function the save route runs), placement rules (one page
 * shell, only at the root) and the phone layout check.
 *
 * `ok` is false only for structure, save and placement problems, which would stop a save or
 * break the page. Phone problems are warnings: the page works, but looks wrong on a phone.
 *
 * WHY one function: the tools, the SDK and the in-editor assistant must all agree on what
 * "valid" means, and the save route is the final judge, so its rules are checked here too.
 */
export const checkPage = ({
	blocks,
	contentType = "page",
}: {
	blocks: BlockConfig[];
	contentType?: "page" | "post";
}): CheckPageResult => {
	const structure = structureProblems(blocks);
	const problems = [
		...structure,
		...saveProblems({ blocks, contentType, structure }),
		...placementProblems(blocks),
		...phoneProblems(blocks),
	];
	return { ok: !problems.some((problem) => problem.kind !== "phone"), problems };
};
