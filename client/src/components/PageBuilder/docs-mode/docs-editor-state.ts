import { useCallback, useRef, useState, type MutableRefObject } from "react";
import type { PageOther } from "@shared/schema-types";
import { readDocsPageDraft } from "./docs-page-draft";
import type { DocsPageDraft, DocsView, MdxIssue } from "./docs-types";

/**
 * What the docs editor keeps outside the page builder's own state, owned by the editor page so the
 * header (view switch, Publish) and the builder (canvas, panels) read the same copy:
 * the view, the MDX problem that blocks leaving it, and the settings that live in `page.other`.
 */
export type DocsEditorState = {
	view: DocsView;
	/** Changes the view. Leaving MDX first reads the text, and stays put when it can't be read. */
	setView: (view: DocsView) => void;
	/** Set by the MDX view while it is open: reads the text now and says whether the page matches it. */
	beforeVisual: MutableRefObject<(() => boolean) | null>;
	/** Set while the MDX text can't be read; Visual and Publish wait until it is fixed. */
	mdxIssue: MdxIssue | null;
	setMdxIssue: (issue: MdxIssue | null) => void;
	/** The Page tab's description and sidebar flag: edited here, saved with the page. */
	draft: DocsPageDraft;
	setDraft: (patch: Partial<DocsPageDraft>) => void;
	/** Starts again for a page that just loaded (or its saved local copy): Visual view, no problem, its own settings. */
	loadPage: (other: PageOther | null | undefined) => void;
};

/** The plain sentence a blocked action shows, from the MDX problem that blocks it. */
export const describeMdxBlock = (issue: MdxIssue): string => (issue.line !== null ? `Fix line ${issue.line} first` : "Fix the MDX first");

export function useDocsEditorState(): DocsEditorState {
	const [view, setViewState] = useState<DocsView>("visual");
	const [mdxIssue, setMdxIssue] = useState<MdxIssue | null>(null);
	const [draft, setDraftState] = useState<DocsPageDraft>({ description: "", hidden: false });

	const beforeVisual = useRef<(() => boolean) | null>(null);
	const setView = useCallback((next: DocsView) => {
		if (next === "visual" && beforeVisual.current && !beforeVisual.current()) return;
		setViewState(next);
	}, []);
	const setDraft = useCallback((patch: Partial<DocsPageDraft>) => setDraftState((current) => ({ ...current, ...patch })), []);
	const loadPage = useCallback((other: PageOther | null | undefined) => {
		setViewState("visual");
		setMdxIssue(null);
		setDraftState(readDocsPageDraft(other));
	}, []);

	return { view, setView, beforeVisual, mdxIssue, setMdxIssue, draft, setDraft, loadPage };
}
