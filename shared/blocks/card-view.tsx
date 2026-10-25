import * as React from "react";
import type { ElementExtras } from "./view-attributes.js";
import { CARD_BODY_CLASS, type CardContent } from "./card-model.js";
import { GRID_ITEMS_CLASS, gridClassNames, gridStyleVars, type GridContent } from "./grid-model.js";

/**
 * A card, the same markup for the Card block and the MDX `<Card>` tag. A link is an overlay
 * anchor beside the body, not around it, so buttons and links inside the card stay valid (an
 * anchor never nests in an anchor).
 */
export function CardView({
	content,
	className,
	style,
	attributes,
	children,
}: ElementExtras & { content: CardContent; children?: React.ReactNode }): React.ReactElement {
	const classes = ["wp-block-card", `np-card--${content.look}`, content.link ? "is-linked" : "", className].filter(Boolean).join(" ");
	const newTab = content.linkTarget === "_blank";
	return (
		<div className={classes} style={style} {...attributes}>
			{content.link ? (
				<a
					className="np-card__link"
					href={content.link}
					aria-label={content.linkLabel || "Open"}
					target={newTab ? "_blank" : undefined}
					rel={newTab ? "noopener noreferrer" : undefined}
				/>
			) : null}
			<div className={CARD_BODY_CLASS}>
				{content.title ? <h3 className="np-card__title">{content.title}</h3> : null}
				{children}
			</div>
		</div>
	);
}

/** The grid wrapper and its item box, sized by inline CSS variables; shared by the Grid block and the MDX `<Cards>` tag. */
export function GridView({
	content,
	className,
	style,
	attributes,
	children,
}: ElementExtras & { content: GridContent; children?: React.ReactNode }): React.ReactElement {
	const classes = [...gridClassNames(content), className].filter(Boolean).join(" ");
	return (
		<div className={classes} style={{ ...style, ...gridStyleVars(content) }} {...attributes}>
			<div className={GRID_ITEMS_CLASS}>{children}</div>
		</div>
	);
}
