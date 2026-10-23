import type { BlockConfig } from "../schema-types.js";
import { applyResponsiveHealthFixes, validateBlockResponsiveHealth } from "../validate-block-responsive-health.js";
import { checkPage } from "./check-page.js";
import { commitTree, describeExistingProblems, emptySummary, PAGE_CLEAN_LINE } from "./commit-change.js";
import { formatProblems } from "./format-problems.js";
import { patchBlockTree } from "./patch-block-tree.js";
import { defineTool, readPageTree, type SerialQueue } from "./tool-helpers.js";
import { findBlockById } from "./tree-find.js";
import type { BlockPatchOp, PageTool, PageToolContext, PageToolResult } from "./types.js";

const MAX_PROBLEMS_SHOWN = 20;

const createCheckPageTool = (ctx: PageToolContext): PageTool =>
	defineTool({
		ctx,
		definition: {
			name: "check_page",
			title: "Check page",
			description:
				"Checks the whole page and lists every problem. Four kinds: structure (unknown block names, repeated ids, children inside a block that cannot hold any), save (what the server would refuse when saving, such as a bad icon or tag name), placement (one page shell, only at the root), and phone (layouts that overflow or break on a phone). Structure, save and placement problems must be fixed; phone problems are warnings that apply_phone_fixes can usually repair. change_blocks already checks the page after every change, so use this to review a page you did not just change, or when the person asks for a check.",
			inputShape: {},
			changesPage: false,
			run: async () => {
				const read = await readPageTree(ctx);
				if (!read.ok) return read.result;
				const { ok, problems } = checkPage({ blocks: read.blocks });
				if (problems.length === 0) return { ok: true, text: "The page is clean: no problems found." };
				const mustFix = problems.filter((problem) => problem.kind !== "phone").length;
				const warnings = problems.length - mustFix;
				return {
					ok,
					text: [
						ok
							? `The page can be saved. ${warnings} phone warning${warnings === 1 ? "" : "s"}:`
							: `${mustFix} problem${mustFix === 1 ? "" : "s"} must be fixed${warnings > 0 ? `, plus ${warnings} phone warning${warnings === 1 ? "" : "s"}` : ""}:`,
						formatProblems({ problems, max: MAX_PROBLEMS_SHOWN }),
					].join("\n"),
				};
			},
		},
	});

/** Update ops that give each fixed block its repaired styles. */
const buildFixOps = ({ fixed, ids }: { fixed: BlockConfig[]; ids: string[] }): BlockPatchOp[] =>
	ids.flatMap((id) => {
		const block = findBlockById({ blocks: fixed, id });
		return block ? [{ op: "update" as const, id, set: { styles: block.styles } }] : [];
	});

const runPhoneFixes = async (ctx: PageToolContext): Promise<PageToolResult> => {
	const read = await readPageTree(ctx);
	if (!read.ok) return read.result;
	const tree = read.blocks;

	// With a selected block only its part of the page may change.
	const focus = ctx.focusBlockId ? findBlockById({ blocks: tree, id: ctx.focusBlockId }) : null;
	if (ctx.focusBlockId && !focus) {
		return { ok: false, text: `The selected block (id ${ctx.focusBlockId}) is no longer on the page. Read the outline again.` };
	}
	const scope = focus ? [focus] : tree;

	const fixable = validateBlockResponsiveHealth(scope).issues.filter((issue) => issue.fix);
	if (fixable.length === 0) {
		const left = validateBlockResponsiveHealth(scope).issues.length;
		return {
			ok: true,
			text: left > 0 ? `Nothing to fix automatically. ${left} phone warning${left === 1 ? "" : "s"} need a manual change; run check_page to see them.` : "Nothing to fix: no phone problems found.",
		};
	}

	const ids = [...new Set(fixable.map((issue) => issue.blockId))];
	const ops = buildFixOps({ fixed: applyResponsiveHealthFixes(scope).blocks, ids });
	const patched = patchBlockTree({ blocks: tree, ops, validate: false });
	if (!patched.ok) return { ok: false, text: `The phone fixes could not be applied: ${patched.error.message}. Nothing was changed.` };

	const committed = await commitTree({
		ctx,
		before: tree,
		after: patched.blocks,
		ops,
		summary: { ...emptySummary(), updated: patched.summary.updated },
		touched: new Set(ids),
	});
	if (!committed.ok) return { ok: false, text: committed.text };

	return {
		ok: true,
		text: [
			`Fixed ${ids.length} block${ids.length === 1 ? "" : "s"} for phones:`,
			...fixable.map((issue) => `- block ${issue.blockId}: ${issue.fix?.label} (${Object.entries(issue.fix?.styles ?? {}).map(([key, value]) => `${key}: ${value}`).join(", ")})`),
			...(committed.value.clean ? [PAGE_CLEAN_LINE] : []),
			...describeExistingProblems(committed.value.existingProblems),
		].join("\n"),
	};
};

const createPhoneFixesTool = ({ ctx, queue }: { ctx: PageToolContext; queue: SerialQueue }): PageTool =>
	defineTool({
		ctx,
		definition: {
			name: "apply_phone_fixes",
			title: "Fix phone layout",
			description:
				'Repairs the phone-layout problems check_page reports as warnings, wherever there is an obvious fix: a fixed width wider than a phone becomes "width: 100%" with the old width as a maximum, and a box with a max width is told to fill its space. When a block is selected, only that block and what is inside it are fixed. Returns what was changed. Problems with no automatic fix stay; check_page lists them. Run it when a change reply lists phone warnings.',
			inputShape: {},
			changesPage: true,
			run: () => queue(() => runPhoneFixes(ctx)),
		},
	});

/** `check_page` and `apply_phone_fixes`. */
export const createCheckTools = ({ ctx, queue }: { ctx: PageToolContext; queue: SerialQueue }): PageTool[] => [
	createCheckPageTool(ctx),
	createPhoneFixesTool({ ctx, queue }),
];
