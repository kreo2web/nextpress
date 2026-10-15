import type { CSSProperties } from "react";
import type { BlockConfig } from "./schema-types.js";
import { resolveShellPadding } from "./page-shell-padding.js";
import { fillToBackgroundStyles } from "./fill-model.js";
import {
	isFullBleedPageShellChild,
	readPageShellContent,
	type PageShellContent,
} from "./page-shell-model.js";

const tokenCss = (entry: PageShellContent["backgroundColor"]): string | undefined => {
	if (!entry) return undefined;
	if (typeof entry.style === "string" && entry.style) return entry.style;
	return undefined;
};

/** The content column a header can follow: width, position, and side padding. */
export type PageColumnInset = {
	maxWidth: string;
	marginLeft: string;
	marginRight: string;
	padLeft: string;
	padRight: string;
};

/** True when the page column is told to fill the canvas (no max width). */
export function isFullPageColumn(width: string): boolean {
	const trimmed = width.trim();
	return trimmed === "" || trimmed === "100%" || trimmed === "none";
}

/**
 * The inset a header follows so its inner bar lines up with the text column.
 * Content width caps the column; side padding sits inside that box; leftover
 * space follows contentAlign (center by default).
 */
export function readPageColumnInset(content: PageShellContent): PageColumnInset {
	const padding = resolveShellPadding(content);
	const isFull = isFullPageColumn(content.containerWidth);
	const align = content.contentAlign ?? "center";
	return {
		maxWidth: isFull ? "100%" : content.containerWidth,
		marginLeft: isFull ? "0" : align === "right" ? "auto" : align === "left" ? "0" : "auto",
		marginRight: isFull ? "0" : align === "left" ? "auto" : align === "right" ? "0" : "auto",
		padLeft: padding.left,
		padRight: padding.right,
	};
}

/** Full-bleed page canvas: font, colors and background fill, no inner padding. */
export function buildPageShellOuterStyle({
	content,
}: {
	content: PageShellContent;
}): CSSProperties {
	const backgroundColor = tokenCss(content.backgroundColor);
	const color = tokenCss(content.textColor);
	const inset = readPageColumnInset(content);
	return {
		width: "100%",
		boxSizing: "border-box",
		display: "flex",
		flexDirection: "column",
		alignItems: "stretch",
		fontFamily: content.fontFamily,
		...(backgroundColor ? { backgroundColor } : {}),
		...(content.backgroundFill ? fillToBackgroundStyles(content.backgroundFill) : {}),
		...(color ? { color } : {}),
		["--np-page-pad-left" as string]: inset.padLeft,
		["--np-page-pad-right" as string]: inset.padRight,
		["--np-page-max-width" as string]: inset.maxWidth,
		["--np-page-margin-left" as string]: inset.marginLeft,
		["--np-page-margin-right" as string]: inset.marginRight,
	};
}

const contentSiblings = (siblings: BlockConfig[] | undefined, child: BlockConfig): BlockConfig[] =>
	(siblings ?? [child]).filter((item) => !isFullBleedPageShellChild(item));

/**
 * The text column: content width caps it, side padding is inside that box, and
 * leftover space on a wide page follows left / center / right.
 */
const contentColumnSides = ({
	content,
	padding,
}: {
	content: PageShellContent;
	padding: ReturnType<typeof resolveShellPadding>;
}): CSSProperties => {
	const inset = readPageColumnInset(content);
	return {
		boxSizing: "border-box",
		width: "100%",
		minWidth: 0,
		maxWidth: inset.maxWidth,
		marginLeft: inset.marginLeft,
		marginRight: inset.marginRight,
		paddingLeft: padding.left,
		paddingRight: padding.right,
	};
};

/**
 * Constrains each child to the content column.
 * A header stays full-bleed so its background reaches the page edge; its inner
 * bar follows the column through `--np-page-*`. Top and bottom padding stay on
 * the first and last text blocks, not between every block.
 */
export function getPageShellChildItemStyle({
	child,
	content,
	siblings,
}: {
	child: BlockConfig;
	content: PageShellContent;
	/** Shell children, so top and bottom padding are not repeated between blocks. */
	siblings?: BlockConfig[];
}): CSSProperties {
	const padding = resolveShellPadding(content);
	if (isFullBleedPageShellChild(child)) {
		return {
			boxSizing: "border-box",
			width: "100%",
			maxWidth: "100%",
			minWidth: 0,
		};
	}
	const column = contentSiblings(siblings, child);
	const isFirst = column[0]?.id === child.id;
	const isLast = column[column.length - 1]?.id === child.id;
	return {
		...contentColumnSides({ content, padding }),
		...(isFirst ? { paddingTop: padding.top } : {}),
		...(isLast ? { paddingBottom: padding.bottom } : {}),
	};
}

export function readPageShellContentFromBlock(block: BlockConfig): PageShellContent {
	return readPageShellContent(block.content);
}
