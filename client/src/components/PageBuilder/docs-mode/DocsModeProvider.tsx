import { useCallback, useMemo, useRef, type MutableRefObject, type ReactElement, type ReactNode } from "react";
import { replaceDocsPageContent } from "@shared/docs/docs-page-frame";
import type { BlockConfig } from "@shared/schema-types";
import { findBlock, insertNewBlock } from "@/lib/handlers/treeUtils";
import { buildDocsCanvasSource, DocsCanvasSourceProvider } from "./docs-canvas-source";
import { findDocsPageBlock, readPageToggles, togglePatch } from "./docs-blocks";
import type { DocsEditorState } from "./docs-editor-state";
import { locateNavItem } from "./docs-nav-model";
import { DocsFrameProvider } from "./docs-frame-context";
import { DocsModeContextProvider, type DocsDragBridge, type DocsModeValue } from "./docs-mode-context";
import type { DocsFrameRegion, DocsPageMeta, DocsPageToggleKey } from "./docs-types";
import { useDocsPanel } from "./use-docs-panel";
import { useDocsSettings } from "./use-docs-settings";
import { useDocsTree, useRefreshDocsTrees } from "./use-docs-tree";

/** What the editor page hands the page builder to switch it into docs mode. */
export type DocsModeProps = {
	state: DocsEditorState;
	/** Called after the server changed this page's own row, so the editor takes the page's new version. */
	onServerChange: () => Promise<void>;
};

type Props = {
	/** Null in the page builder: the provider then renders its children as they are. */
	docs: DocsModeProps | null;
	pageId: string;
	siteId: string;
	blocks: BlockConfig[];
	getBlocks: () => BlockConfig[];
	meta: DocsPageMeta;
	onMetaChange: (meta: Partial<{ title: string; slug: string; status: string }>) => void;
	selectedBlockId: string | null;
	selectBlock: (id: string | null) => void;
	updateBlock: (id: string, updates: Partial<BlockConfig>) => void;
	commitBlocks: (next: BlockConfig[]) => void;
	/** Saves the page as the Save button does (`blocks` overrides the tree when it is newer than what has been drawn). */
	save: (blocks?: BlockConfig[]) => void;
	/** Where the navigation list and the page builder meet over one drag (the builder owns it). */
	dragBridge: MutableRefObject<DocsDragBridge>;
	/** Replaces the whole tree as one undo step (`newStep`) or into the step a run already opened. */
	applyBlocks: (next: BlockConfig[], options: { newStep: boolean }) => void;
	children: ReactNode;
};

/** The address up to the page's own part: `/docs/guides/` for `/docs/guides/install`. */
const addressPrefixOf = ({ path, slug }: { path: string; slug: string }): string => (slug && path.endsWith(slug) ? path.slice(0, path.length - slug.length) : "/");

function DocsModeActive({ docs, ...props }: Props & { docs: DocsModeProps }): ReactElement {
	const { pageId, siteId, blocks, getBlocks, meta, onMetaChange, selectedBlockId, selectBlock, updateBlock, commitBlocks, applyBlocks, save, dragBridge, children } = props;
	const { state: editor } = docs;
	const { tree, isLoading, failed } = useDocsTree({ pageId });
	const refreshDocsTrees = useRefreshDocsTrees();
	const panel = useDocsPanel({ pickedBlockId: selectedBlockId });
	const mdxInsert = useRef<((text: string) => void) | null>(null);

	const homeId = tree?.home.id ?? "";
	const isHome = tree ? tree.home.id === pageId : false;
	const docsPage = useMemo(() => findDocsPageBlock(blocks), [blocks]);
	const toggles = useMemo(() => readPageToggles(docsPage), [docsPage]);
	const selectedBlock = useMemo(() => (selectedBlockId ? findBlock(blocks, selectedBlockId) : null), [blocks, selectedBlockId]);
	const { settings, saveSettings } = useDocsSettings({ pageId, homeId, isHome, tree, blocks, updateBlock });

	const current = tree ? (isHome ? tree.home : (locateNavItem({ home: tree.home, id: pageId })?.item ?? null)) : null;
	const addressPrefix = current ? addressPrefixOf({ path: current.path, slug: current.slug }) : "/";

	const setToggle = useCallback(
		(key: DocsPageToggleKey, on: boolean) => {
			if (docsPage) updateBlock(docsPage.id, togglePatch({ key, on }));
		},
		[docsPage, updateBlock],
	);

	const insertBlock = useCallback(
		(name: string) => {
			const tree = getBlocks();
			const page = findDocsPageBlock(tree);
			if (!page) return;
			const siblings = page.children ?? [];
			const picked = selectedBlockId ? siblings.findIndex((child) => child.id === selectedBlockId) : -1;
			const inserted = insertNewBlock(tree, page.id, picked >= 0 ? picked + 1 : siblings.length, name);
			if (!inserted.newId) return;
			commitBlocks(inserted.blocks);
			selectBlock(inserted.newId);
		},
		[commitBlocks, getBlocks, selectBlock, selectedBlockId],
	);

	const applyContent = useCallback(
		(children: BlockConfig[], options: { newStep: boolean }): BlockConfig[] => {
			const next = replaceDocsPageContent({ blocks: getBlocks(), children });
			applyBlocks(next, options);
			return next;
		},
		[applyBlocks, getBlocks],
	);

	const latest = useRef({ selectBlock, openSection: panel.openSection });
	latest.current = { selectBlock, openSection: panel.openSection };
	const openRegion = useCallback((region: DocsFrameRegion) => {
		latest.current.selectBlock(null);
		latest.current.openSection(region === "header" ? "header" : "navigation");
	}, []);

	const value: DocsModeValue = {
		pageId,
		siteId,
		editor,
		meta,
		setMeta: onMetaChange,
		blocks,
		docsPage,
		toggles,
		setToggle,
		tree,
		treeLoading: isLoading,
		treeFailed: failed,
		homeId,
		isHome,
		addressPrefix,
		settings,
		saveSettings,
		refreshTree: refreshDocsTrees,
		syncAfterServerChange: docs.onServerChange,
		panel,
		dragBridge,
		mdxInsert,
		selectedBlock,
		selectBlock,
		insertBlock,
		applyContent,
		saveNow: save,
	};
	const source = useMemo(() => buildDocsCanvasSource({ tree, pageId, isHome, meta, draft: editor.draft }), [editor.draft, isHome, meta, pageId, tree]);

	return (
		<DocsModeContextProvider value={value}>
			<DocsCanvasSourceProvider value={source}>
				<DocsFrameProvider openRegion={openRegion}>{children}</DocsFrameProvider>
			</DocsCanvasSourceProvider>
		</DocsModeContextProvider>
	);
}

/**
 * Turns the page builder into the docs editor for everything below it: the panels, the page
 * switcher, the MDX view and the canvas all read this one provider. With `docs` null (any other
 * page) it adds nothing, so the page builder behaves exactly as before.
 */
export function DocsModeProvider({ docs, ...props }: Props): ReactElement {
	if (!docs) return <>{props.children}</>;
	return <DocsModeActive docs={docs} {...props} />;
}
