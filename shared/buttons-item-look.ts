import type { CSSProperties } from "react";
import {
	BUTTON_SIZE_STYLES,
	THEME_BUTTON_FILL,
	THEME_BUTTON_TEXT,
	type ButtonLook,
	type ButtonSize,
} from "./button-look.js";

export type ButtonsItemLook = {
	look?: ButtonLook;
	size?: ButtonSize;
	backgroundColor?: string;
	color?: string;
	borderRadius?: string;
};

const BUTTON_SIZES: readonly ButtonSize[] = ["sm", "md", "lg", "xl"];

export function readButtonsItemLook(look: unknown): ButtonLook {
	return look === "ghost" ? "ghost" : "solid";
}

export function readButtonsItemSize(size: unknown): ButtonSize {
	return BUTTON_SIZES.find((value) => value === size) ?? "lg";
}

function cssColor(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/**
 * Paint one chip inside a Buttons row. Look / size / colours live on the item so the row
 * can mix solid and ghost without nesting Button blocks.
 */
export function buttonsItemLinkStyle({
	item,
	orientation,
}: {
	item: {
		look?: unknown;
		size?: unknown;
		backgroundColor?: unknown;
		color?: unknown;
		borderRadius?: unknown;
	};
	orientation: string;
}): CSSProperties {
	const look = readButtonsItemLook(item.look);
	const size = BUTTON_SIZE_STYLES[readButtonsItemSize(item.size)];
	const fill = cssColor(item.backgroundColor);
	const text = cssColor(item.color);
	const radius = cssColor(item.borderRadius) ?? "var(--npb-radius-input, 4px)";

	if (look === "ghost") {
		const accent = fill && fill !== "transparent" ? fill : text ?? THEME_BUTTON_FILL;
		return {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: "transparent",
			color: accent,
			border: "1px solid currentColor",
			padding: size.padding,
			fontSize: size.fontSize,
			fontWeight: 600,
			borderRadius: radius,
			textDecoration: "none",
			cursor: "pointer",
			width: orientation === "vertical" ? "100%" : undefined,
			maxWidth: "100%",
			whiteSpace: "normal",
			overflowWrap: "anywhere",
		};
	}

	return {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: fill ?? THEME_BUTTON_FILL,
		color: text ?? THEME_BUTTON_TEXT,
		border: "none",
		padding: size.padding,
		fontSize: size.fontSize,
		fontWeight: 600,
		borderRadius: radius,
		textDecoration: "none",
		cursor: "pointer",
		width: orientation === "vertical" ? "100%" : undefined,
		maxWidth: "100%",
		whiteSpace: "normal",
		overflowWrap: "anywhere",
	};
}

export function buttonsItemFollowsTheme({
	property,
	look,
	backgroundColor,
	color,
}: {
	property: "backgroundColor" | "color";
	look: ButtonLook;
	backgroundColor?: string;
	color?: string;
}): boolean {
	if (property === "backgroundColor") {
		return !cssColor(backgroundColor) || backgroundColor === THEME_BUTTON_FILL;
	}
	if (look === "ghost") {
		return !cssColor(color) || color === THEME_BUTTON_FILL;
	}
	return !cssColor(color) || color === THEME_BUTTON_TEXT;
}

export { THEME_BUTTON_FILL, THEME_BUTTON_TEXT };
