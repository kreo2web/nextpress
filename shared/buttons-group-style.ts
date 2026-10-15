import type { CSSProperties } from "react";

/** Flex layout for a buttons group, shared by canvas and publish. */
export function buttonsGroupStyle({
	layout,
	orientation,
	styles,
}: {
	layout?: string;
	orientation?: string;
	styles?: CSSProperties;
}): CSSProperties {
	const vertical = orientation === "vertical";
	const justifyContent: CSSProperties["justifyContent"] =
		layout === "center"
			? "center"
			: layout === "flex-end" || layout === "right"
				? "flex-end"
				: layout === "space-between"
					? "space-between"
					: "flex-start";
	return {
		...styles,
		display: "flex",
		flexDirection: vertical ? "column" : "row",
		justifyContent,
		gap: vertical ? "0.75em" : "0.5em",
		alignItems: vertical ? "stretch" : "center",
		flexWrap: "wrap",
	};
}
