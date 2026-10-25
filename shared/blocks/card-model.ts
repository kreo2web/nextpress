import type { BlockContent } from "../schema-types.js";
import { readChoice, readStructuredData, readText } from "./read-structured.js";

export const CARD_BLOCK_NAME = "core/card";
export const CARD_BODY_CLASS = "np-card__body";

export const CARD_LOOKS = ["bordered", "raised", "subtle", "plain"] as const;
export type CardLook = (typeof CARD_LOOKS)[number];

/**
 * A box holding other blocks (icon, heading, text, button). With a `link`, the whole card is
 * clickable: an overlay link named by `linkLabel`, so buttons inside still work on their own.
 */
export type CardContent = {
	/** A heading at the top of the card (the MDX `title`). Empty for none. */
	title: string;
	look: CardLook;
	link: string;
	/** What a screen reader says for the card's link, e.g. "Read the pricing guide". */
	linkLabel: string;
	linkTarget: "_self" | "_blank";
};

export const DEFAULT_CARD_CONTENT: CardContent = { title: "", look: "bordered", link: "", linkLabel: "", linkTarget: "_self" };

export function readCardContent(content: BlockContent | undefined): CardContent {
	const data = readStructuredData(content);
	return {
		title: readText(data.title).trim(),
		look: readChoice({ value: data.look, options: CARD_LOOKS, fallback: "bordered" }),
		link: readText(data.link).trim(),
		linkLabel: readText(data.linkLabel).trim(),
		linkTarget: data.linkTarget === "_blank" ? "_blank" : "_self",
	};
}
