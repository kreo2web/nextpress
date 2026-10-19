import type { BlockConfig } from "../schema-types.js";
import { checkBlocksOnTheirOwn, checkPage, type PageProblem } from "./check-page.js";
import { formatProblems } from "./format-problems.js";
import { attempt } from "./tool-helpers.js";
import type { BlockPatchOp, PageToolContext, TreeChange } from "./types.js";

/** Most old problems named in a success reply. */
const MAX_EXISTING_SHOWN = 3;

/** A change that passed every check and was written. */
export type CommittedChange = {
	blocks: BlockConfig[];
	change: TreeChange;
	/** Phone warnings on the blocks this change touched. They never block a change. */
	phoneWarnings: PageProblem[];
	/** Problems that were already on the page before this change and still are. They never block it. */
	existingProblems: PageProblem[];
};

export const emptySummary = (): TreeChange["summary"] => ({ inserted: [], updated: [], deleted: [], moved: [], replaced: [] });

export const addSummary = ({ into, from }: { into: TreeChange["summary"]; from: TreeChange["summary"] }): void => {
	into.inserted.push(...from.inserted);
	into.updated.push(...from.updated);
	into.deleted.push(...from.deleted);
	into.moved.push(...from.moved);
	into.replaced.push(...from.replaced);
};

const problemKey = (problem: PageProblem): string => `${problem.kind}|${problem.blockId ?? ""}|${problem.message}`;

const isBlocking = (problem: PageProblem): boolean => problem.kind !== "phone";

/** The same problem listed once, in first-seen order. */
const withoutRepeats = (problems: PageProblem[]): PageProblem[] => [
	...new Map(problems.map((problem) => [problemKey(problem), problem])).values(),
];

/** Every problem that would stop a save or break the page: the whole-page check plus each touched block on its own. */
const findBlockingProblems = ({ blocks, touched }: { blocks: BlockConfig[]; touched: Set<string> }): PageProblem[] =>
	withoutRepeats([
		...checkPage({ blocks }).problems.filter(isBlocking),
		...checkBlocksOnTheirOwn({ blocks, ids: touched }),
	]);

/** The text for a refused change: only the problems this change would add. */
export const explainRefusedChange = (newProblems: PageProblem[]): string =>
	[
		`Nothing was changed. After these ops the page would have ${newProblems.length} new problem${newProblems.length === 1 ? "" : "s"}:`,
		formatProblems({ problems: newProblems, max: 8 }),
		"Fix them in the ops and send the whole call again.",
	].join("\n");

/** Lines for a success reply that name problems the page already had, so the agent can offer to fix them. */
export const describeExistingProblems = (problems: PageProblem[]): string[] =>
	problems.length === 0
		? []
		: [
				"Already on the page before this change (not caused by it; fix only if asked):",
				formatProblems({ problems, max: MAX_EXISTING_SHOWN }),
			];

type StepResult = { ok: true; value: CommittedChange } | { ok: false; text: string };

/**
 * Checks a changed page and, only when the change adds no new problem, writes it. All or
 * nothing: a new structure, save or placement problem refuses the call, leaves the tree as it
 * was and never reaches `writeTree`. Used by every tool that changes the page, so they all
 * pass the same checks.
 *
 * Only NEW problems block. A page that already has a bad icon must still accept an unrelated
 * change, or the assistant would be stuck on it forever; those old problems are named in the
 * reply instead. A problem is "old" when the page before the change had the same one (same
 * kind, block and message).
 *
 * The server's save check stops at its first error, so a new problem can hide behind an old
 * one. To find it, every block the change touched is also checked on its own.
 *
 * WHY check the finished page and not each op: an agent often needs two ops together to
 * reach a valid page (insert a block, then move another into it), and the server's save
 * rules judge the finished page, not the steps.
 */
export const commitTree = async ({
	ctx,
	before,
	after,
	ops,
	summary,
	touched,
}: {
	ctx: PageToolContext;
	/** The page as the agent last saw it. */
	before: BlockConfig[];
	/** The page with every op applied. */
	after: BlockConfig[];
	ops: BlockPatchOp[];
	summary: TreeChange["summary"];
	/** Ids the change created or changed; their save rules are checked alone, and phone warnings are limited to them. */
	touched: Set<string>;
}): Promise<StepResult> => {
	const blockingAfter = findBlockingProblems({ blocks: after, touched });
	let existingProblems: PageProblem[] = [];
	if (blockingAfter.length > 0) {
		const oldKeys = new Set(findBlockingProblems({ blocks: before, touched }).map(problemKey));
		const newProblems = blockingAfter.filter((problem) => !oldKeys.has(problemKey(problem)));
		if (newProblems.length > 0) return { ok: false, text: explainRefusedChange(newProblems) };
		existingProblems = blockingAfter;
	}

	const change: TreeChange = { blocks: after, ops, summary };
	const written = await attempt(() => ctx.writeTree(change));
	if (!written.ok) {
		ctx.onError?.({ tool: "writeTree", error: written.error });
		return { ok: false, text: `The page was not updated: ${written.error.message}. Read the outline again.` };
	}
	if (!written.value.ok) return { ok: false, text: `The page was not updated: ${written.value.message}` };

	const phoneWarnings = checkPage({ blocks: after }).problems.filter(
		(problem) => problem.kind === "phone" && problem.blockId !== undefined && touched.has(problem.blockId),
	);
	return { ok: true, value: { blocks: after, change, phoneWarnings, existingProblems } };
};
