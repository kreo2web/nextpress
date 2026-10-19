import type { Page } from "./domain.js";

/** A page that the exported page links to, directly or through other linked pages. */
export type PageTransferLinkedPage = {
	id: string;
	title: string;
	slug: string;
	status: string | null;
	/** 1 = the exported page links to it; 2 = a linked page links to it; and so on. */
	depth: number;
	isHomepage: boolean;
	/** Title of the page whose link led here. */
	linkedFrom: string;
};

export type PageTransferLinks = {
	pages: PageTransferLinkedPage[];
	/** Addresses linked to that have no page on this site, e.g. `/terms-and-conditions`. */
	missing: string[];
};

/** Input for `pageTransfer.export`. */
export type ExportPageInput = {
	pageId: string;
	/** Leave images, videos and other files out when false. Default: include them. */
	files?: boolean;
	/** Ids of linked pages (from `links`) that travel along with the main page. At most 50. */
	include?: string[];
};

/** A page file ready to save or hand to `pageTransfer.import` on another site. */
export type PageTransferFile = {
	bytes: Uint8Array;
	/** The name the server suggests, e.g. `about.nextpress-page.json`. */
	fileName: string;
	contentType: string;
};

/** Input for `pageTransfer.import`. */
export type ImportPageInput = {
	/** The page file: the `bytes` from `export`, a `File`/`Blob`, or the file's JSON text. */
	file: Blob | Uint8Array | string;
	fileName: string;
	/** Also bring the page file's theme and make it the site's theme. Default: leave it out. */
	includeTheme?: boolean;
	/** Site to bring the page into. Default: the client's site. */
	siteId?: string;
};

/** What happened to each file when a page file landed on a site. */
export type PageTransferFileReport = {
	/** Old `/uploads/…` path to new path on this site. */
	refMap: Record<string, string>;
	added: string[];
	reused: string[];
	/** Files that became placeholders, with the reason in plain words. */
	missing: { name: string; reason: string }[];
};

export type PageTransferTheme =
	| { status: "none" }
	| { status: "skipped"; name: string }
	| { status: "added" | "reused"; name: string; id: string };

export type PageTransferImportResult = {
	/** The main page, as a draft. */
	page: Page;
	/** Every page that was created; the main page is first. */
	pages: { id: string; title: string; slug: string }[];
	/** Pages whose address was taken here, so they got a new one; links to them follow. */
	renamed: { title: string; from: string; to: string }[];
	files: PageTransferFileReport;
	theme: PageTransferTheme;
};
