import type { ReactElement } from "react";
import { findBlockEntry } from "@shared/block-catalog";
import { cn } from "@/lib/utils";
import { describeMdxBlock } from "./docs-editor-state";
import type { DocsView, MdxIssue } from "./docs-types";

/** The id of the line in the MDX view that names the problem, so the blocked buttons can point at it. */
export const MDX_ISSUE_ID = "docs-mdx-issue";

type Props = {
	view: DocsView;
	onChange: (view: DocsView) => void;
	issue: MdxIssue | null;
	/** Names of blocks on the page that MDX has no form for. Opening MDX would drop them, so it waits until they are gone. */
	mdxBlockedBy?: string[];
};

const buttonClass = (active: boolean, blocked: boolean): string =>
	cn(
		"h-7 rounded-md px-3.5 text-[0.8rem] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-npb-focus",
		active ? "bg-npb-surface-base text-npb-text-primary" : "text-npb-text-muted hover:text-npb-text-primary",
		blocked && "cursor-not-allowed opacity-70 hover:text-npb-text-muted",
	);

const labelOf = (name: string): string => findBlockEntry(name)?.label ?? name;

/** The plain sentence for blocks MDX can't hold. */
export const describeMdxBlockedBy = (names: string[]): string => {
	const labels = Array.from(new Set(names.map(labelOf)));
	return `MDX can't hold ${labels.join(", ")} yet. Remove ${labels.length === 1 ? "it" : "them"} to edit this page as MDX`;
};

/**
 * Visual | MDX. While the MDX can't be read, Visual is off and says why (a button that can't be
 * pressed always names the reason), because turning back would throw the text away. In the same
 * way MDX is off while the page holds blocks it can't write.
 */
export function DocsViewSwitch({ view, onChange, issue, mdxBlockedBy = [] }: Props): ReactElement {
	const visualBlocked = view === "mdx" && issue !== null;
	const mdxBlocked = view === "visual" && mdxBlockedBy.length > 0;
	const visualReason = visualBlocked && issue ? describeMdxBlock(issue) : null;
	const mdxReason = mdxBlocked ? describeMdxBlockedBy(mdxBlockedBy) : null;
	return (
		<div role="group" aria-label="Edit as" className="inline-flex gap-0.5 rounded-lg bg-npb-surface-inset p-[3px]">
			<span title={visualReason ?? undefined}>
				<button
					type="button"
					aria-pressed={view === "visual"}
					disabled={visualBlocked}
					aria-describedby={visualBlocked ? MDX_ISSUE_ID : undefined}
					className={cn(buttonClass(view === "visual", visualBlocked), visualBlocked && "line-through")}
					onClick={() => onChange("visual")}
				>
					Visual
					{visualReason ? <span className="sr-only">. {visualReason}</span> : null}
				</button>
			</span>
			<span title={mdxReason ?? undefined}>
				<button type="button" aria-pressed={view === "mdx"} disabled={mdxBlocked} className={buttonClass(view === "mdx", mdxBlocked)} onClick={() => onChange("mdx")}>
					MDX
					{mdxReason ? <span className="sr-only">. {mdxReason}</span> : null}
				</button>
			</span>
		</div>
	);
}
