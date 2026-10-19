import type { PageProblem } from "./check-page.js";

const DEFAULT_MAX_SHOWN = 12;

/** Page problems as short lines for a model: kind, block id, what is wrong, how to fix it. */
export const formatProblems = ({ problems, max = DEFAULT_MAX_SHOWN }: { problems: PageProblem[]; max?: number }): string => {
	const lines = problems.slice(0, max).map((problem) => {
		const where = problem.blockId ? ` block ${problem.blockId}:` : "";
		const fix = problem.fix ? ` Fix: ${problem.fix}` : "";
		return `- [${problem.kind}]${where} ${problem.message}${fix}`;
	});
	const more = problems.length - max;
	return [...lines, ...(more > 0 ? [`- and ${more} more`] : [])].join("\n");
};
