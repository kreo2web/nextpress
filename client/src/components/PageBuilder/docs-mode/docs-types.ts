/** Which way the page is shown: the real frame with blocks, or the page as MDX text. */
export type DocsView = "visual" | "mdx";

/** Why the MDX text can't become blocks yet. `line` is where to look, or null when the parser could not say. */
export type MdxIssue = { line: number | null; message: string };

/** The page settings that live in `page.other` (not in the blocks): saved with the page, never on their own. */
export type DocsPageDraft = { description: string; hidden: boolean };

/** The right panel's tabs. `block` only exists while a block is picked. */
export type DocsPanelTab = "page" | "docs" | "block";

/** The sections of the Docs tab. A click on the canvas opens one of them. */
export type DocsSection = "header" | "navigation" | "search" | "features" | "address";

/** The page's own switches for the parts around its text (a part also needs the docs-wide switch on). */
export type DocsPageToggles = { showToc: boolean; showPrevNext: boolean; copyPage: boolean };
export type DocsPageToggleKey = keyof DocsPageToggles;

/** Where the canvas was clicked in the frame; each opens the Docs tab at its section. */
export type DocsFrameRegion = "header" | "sidebar";

/** What the page switcher and the editor header show about the page being edited. */
export type DocsPageMeta = { title: string; slug: string; status: string; version: number };
