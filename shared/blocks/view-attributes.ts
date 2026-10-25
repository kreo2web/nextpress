import type { CSSProperties, HTMLAttributes } from "react";

/** Extra attributes a block puts on its outer element (id, data-*, aria-*), as the published renderers pass them. */
export type ViewAttributes = HTMLAttributes<HTMLElement>;

/** The class, inline style and attributes every shared view accepts on its outer element. */
export type ElementExtras = {
	className?: string;
	style?: CSSProperties;
	attributes?: ViewAttributes;
};
