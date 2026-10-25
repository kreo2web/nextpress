import React from "react";
import { SquareDashed } from "lucide-react";
import { CARD_BODY_CLASS, DEFAULT_CARD_CONTENT, readCardContent, type CardContent } from "@shared/blocks/card-model";
import { ContainerChildren } from "../../BlockRenderer";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { CardSettings } from "./card-settings";

/**
 * Canvas view: same classes as the published card. There is no overlay link here, because it
 * would sit on top of the children and stop them being selected; a muted line shows the link.
 */
const CardBlock = createBlockDefinition<CardContent>({
	...catalogMeta("core/card"),
	icon: SquareDashed,
	handlesOwnChildren: true,
	defaultContent: DEFAULT_CARD_CONTENT,
	parseContent: (raw) => readCardContent(raw),
	settings: CardSettings,
	hasSettings: true,
	render: ({ value, content, isPreview, onNestedBlockChange }) => (
		<div className={["wp-block-card", `np-card--${content.look}`, content.link ? "is-linked" : ""].filter(Boolean).join(" ")}>
			{content.title ? <h3 className="np-card__title">{content.title}</h3> : null}
			<ContainerChildren block={value} isPreview={isPreview ?? false} stackClassName={CARD_BODY_CLASS} onBlockChange={onNestedBlockChange} />
			{content.link ? <p className="np-card__link-note">Links to {content.link}</p> : null}
		</div>
	),
});

export default CardBlock;
