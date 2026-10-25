import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readDocsPageContent } from "@shared/docs/docs-page-frame";
import { blocksToMdx, mdxToBlocks } from "@shared/mdx-blocks";
import type { BlockConfig } from "@shared/schema-types";
import { generateBlockId } from "../utils";
import { describeMdxProblem } from "./mdx-issue-words";
import type { DocsModeValue } from "./docs-mode-context";
import type { MdxIssue } from "./docs-types";

/** How long typing must pause before the text is read as blocks again. */
export const MDX_SYNC_DELAY_MS = 300;

/**
 * The MDX view's text and its link to the page's blocks.
 *
 * Typing is read as MDX once it pauses. When it reads, the page's content becomes those blocks, so
 * Save and Publish always act on what the box shows; when it doesn't, the blocks stay as the last
 * good text made them and the problem (with its line) is raised for the header to act on. The whole
 * visit is one undo step: the first change opens it and the rest replace it. WHY not rebuild the
 * blocks when the text is unchanged: a round trip through MDX makes new blocks, so opening the view
 * and leaving it again must not touch the page.
 */
export function useMdxView({ docs }: { docs: DocsModeValue }): {
	text: string;
	issue: MdxIssue | null;
	edit: (next: string) => void;
	/**
	 * Reads the text now. `ok` is true when the page now matches it (or already did) and false when it
	 * can't be read; `tree` is the page's whole tree when this call changed it, for a save that must not wait for a redraw.
	 */
	flush: () => { ok: boolean; tree: BlockConfig[] | null };
} {
	const { blocks, applyContent, editor } = docs;
	const content = useMemo(() => readDocsPageContent(blocks), [blocks]);
	const [text, setText] = useState(() => blocksToMdx(content).mdx);
	const [issue, setIssueState] = useState<MdxIssue | null>(null);

	const latest = useRef({ text, applyContent, setMdxIssue: editor.setMdxIssue });
	latest.current = { ...latest.current, applyContent, setMdxIssue: editor.setMdxIssue };
	const syncedText = useRef(text);
	const opened = useRef(false);
	const applying = useRef(false);
	const seenContent = useRef(content);
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const setIssue = useCallback((next: MdxIssue | null): void => {
		setIssueState(next);
		latest.current.setMdxIssue(next);
	}, []);

	const sync = useCallback(
		(value: string): { ok: boolean; tree: BlockConfig[] | null } => {
			if (value === syncedText.current) {
				setIssue(null);
				return { ok: true, tree: null };
			}
			const parsed = mdxToBlocks({ text: value, newId: generateBlockId });
			if (!parsed.ok) {
				setIssue({ line: parsed.line, message: describeMdxProblem(parsed.message) });
				return { ok: false, tree: null };
			}
			setIssue(null);
			applying.current = true;
			const tree = latest.current.applyContent(parsed.blocks, { newStep: !opened.current });
			opened.current = true;
			syncedText.current = value;
			return { ok: true, tree };
		},
		[setIssue],
	);

	const clearTimer = (): void => {
		if (timer.current) clearTimeout(timer.current);
		timer.current = null;
	};

	const edit = useCallback(
		(next: string): void => {
			setText(next);
			latest.current.text = next;
			clearTimer();
			timer.current = setTimeout(() => {
				timer.current = null;
				sync(latest.current.text);
			}, MDX_SYNC_DELAY_MS);
		},
		[sync],
	);

	const flush = useCallback((): { ok: boolean; tree: BlockConfig[] | null } => {
		clearTimer();
		return sync(latest.current.text);
	}, [sync]);

	// Undo or Redo (or anything else outside the box) changed the page's content: show it.
	useEffect(() => {
		if (content === seenContent.current) return;
		seenContent.current = content;
		if (applying.current) {
			applying.current = false;
			return;
		}
		const next = blocksToMdx(content).mdx;
		clearTimer();
		setText(next);
		latest.current.text = next;
		syncedText.current = next;
		opened.current = false;
		setIssue(null);
	}, [content, setIssue]);

	// A pause that outlives the view must not read text into a page that is no longer open.
	useEffect(
		() => () => {
			if (timer.current) clearTimeout(timer.current);
			latest.current.setMdxIssue(null);
		},
		[],
	);

	return { text, issue, edit, flush };
}
