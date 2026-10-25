import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactElement } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MDX_ISSUE_ID } from "./DocsViewSwitch";
import { useRequiredDocsMode } from "./docs-mode-context";
import { countLines, insertSnippet, lineEndIndex, lineStartIndex, positionOf, shiftIndent } from "./mdx-text";
import { useMdxView } from "./use-mdx-view";

const LINE_HEIGHT = 22;
const EDITOR_FONT = "13px/22px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** Keys that must reach the text box alone: the editor's own shortcuts (undo a block, delete a block…) would act on the page instead. */
const keepInBox = (event: KeyboardEvent): boolean => !((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s");

/**
 * The page as MDX text, in place of the canvas: a monospace box with line numbers and a status
 * bar. A problem in the text is raised as a bar naming the line, and the line is marked. No code
 * editor library: a plain text box whose line numbers follow its scrolling.
 */
export function MdxView(): ReactElement {
	const docs = useRequiredDocsMode();
	const { text, issue, edit, flush } = useMdxView({ docs });
	const box = useRef<HTMLTextAreaElement | null>(null);
	const [scrollTop, setScrollTop] = useState(0);
	const [cursor, setCursor] = useState({ line: 1, column: 1 });
	const lines = countLines(text);
	const issueLine = issue?.line ?? null;

	// The header's Visual button and the block list reach the box through the editor's shared handles.
	const latest = useRef({ flush, edit });
	latest.current = { flush, edit };
	useEffect(() => {
		docs.editor.beforeVisual.current = () => latest.current.flush().ok;
		docs.mdxInsert.current = (snippet) => {
			const element = box.current;
			if (!element) return;
			const next = insertSnippet({ text: element.value, index: element.selectionStart, snippet });
			latest.current.edit(next.text);
			requestAnimationFrame(() => {
				element.focus();
				element.setSelectionRange(next.cursor, next.cursor);
			});
		};
		return () => {
			docs.editor.beforeVisual.current = null;
			docs.mdxInsert.current = null;
		};
	}, [docs.editor.beforeVisual, docs.mdxInsert]);

	const goToLine = (line: number): void => {
		const element = box.current;
		if (!element) return;
		element.focus();
		element.setSelectionRange(lineStartIndex({ text: element.value, line }), lineEndIndex({ text: element.value, line }));
		element.scrollTop = Math.max(0, (line - 1) * LINE_HEIGHT - element.clientHeight / 3);
	};

	useLayoutEffect(() => {
		const element = box.current;
		if (element) setCursor(positionOf({ text, index: element.selectionStart }));
	}, [text]);

	const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
		if (keepInBox(event)) event.stopPropagation();
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
			event.preventDefault();
			event.stopPropagation();
			const result = flush();
			if (result.ok) docs.saveNow(result.tree ?? undefined);
			return;
		}
		if (event.key === "Escape") {
			event.currentTarget.blur();
			return;
		}
		if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) {
			event.preventDefault();
			const element = event.currentTarget;
			const next = shiftIndent({ text: element.value, start: element.selectionStart, end: element.selectionEnd, outdent: event.shiftKey });
			edit(next.text);
			requestAnimationFrame(() => element.setSelectionRange(next.start, next.end));
		}
	};

	const updateCursor = (element: HTMLTextAreaElement): void => setCursor(positionOf({ text: element.value, index: element.selectionStart }));

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-npb-canvas-bg p-3" data-testid="mdx-view">
			<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--npb-radius-surface)] bg-npb-canvas-page shadow-lg">
				{issue ? (
					<div id={MDX_ISSUE_ID} role="alert" className="flex items-center gap-3 border-b border-npb-status-error/30 bg-npb-status-error/10 px-4 py-3 text-sm text-npb-status-error">
						<AlertCircle className="h-5 w-5 shrink-0" aria-hidden />
						<p className="min-w-0 flex-1">
							{issueLine !== null ? <strong>Line {issueLine}: </strong> : null}
							{issue.message}. Visual comes back once it is fixed.
						</p>
						{issueLine !== null ? (
							<Button type="button" variant="outline" size="sm" onClick={() => goToLine(issueLine)}>
								Go to line {issueLine}
							</Button>
						) : null}
					</div>
				) : null}
				<div className="relative flex min-h-0 flex-1 overflow-hidden" style={{ font: EDITOR_FONT }}>
					<div aria-hidden className="w-14 shrink-0 select-none overflow-hidden border-r border-npb-divider bg-npb-surface-raised text-right text-npb-text-muted">
						<div style={{ transform: `translateY(${-scrollTop}px)`, paddingTop: 12 }}>
							{Array.from({ length: lines }, (_, index) => (
								<div key={index} className={`pr-3 ${issueLine === index + 1 ? "bg-npb-status-error/10 font-semibold text-npb-status-error" : ""}`} style={{ height: LINE_HEIGHT }}>
									{index + 1}
								</div>
							))}
						</div>
					</div>
					<div className="relative min-w-0 flex-1">
						{issueLine !== null ? <div aria-hidden className="pointer-events-none absolute inset-x-0 bg-npb-status-error/10" style={{ top: 12 + (issueLine - 1) * LINE_HEIGHT - scrollTop, height: LINE_HEIGHT }} /> : null}
						<textarea
							ref={box}
							value={text}
							aria-label="MDX of this page"
							aria-invalid={issue !== null}
							aria-describedby={issue ? MDX_ISSUE_ID : undefined}
							spellCheck={false}
							wrap="off"
							autoCapitalize="off"
							autoCorrect="off"
							className="absolute inset-0 h-full w-full resize-none overflow-auto whitespace-pre bg-transparent px-4 text-npb-text-primary outline-none"
							style={{ font: EDITOR_FONT, paddingTop: 12, paddingBottom: 12, tabSize: 2 }}
							onChange={(event) => edit(event.target.value)}
							onBlur={() => void flush()}
							onKeyDown={onKeyDown}
							onKeyUp={(event) => updateCursor(event.currentTarget)}
							onClick={(event) => updateCursor(event.currentTarget)}
							onSelect={(event) => updateCursor(event.currentTarget)}
							onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
						/>
					</div>
				</div>
				<div className="flex items-center gap-4 border-t border-npb-divider bg-npb-surface-raised px-4 py-2 text-xs text-npb-text-muted" role="status">
					<span className="font-semibold text-npb-text-secondary">MDX</span>
					<span>{lines} {lines === 1 ? "line" : "lines"}</span>
					<span className="min-w-0 flex-1 truncate">{issue ? "The last text that could be read is what Save keeps." : "Changes are kept as a draft while you type. Esc, then Tab, leaves the box."}</span>
					<span className="tabular-nums">Line {cursor.line}, column {cursor.column}</span>
				</div>
			</div>
		</div>
	);
}
