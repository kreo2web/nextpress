import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { readLogoCloudContent, type LogoItem } from "@shared/blocks/logo-cloud-model";
import { getRenderProps } from "../render-helpers";

type LogoListProps = { logos: LogoItem[]; hidden?: boolean };

/** One list of logos. The marquee's copy is hidden from assistive tech and keyboard focus. */
function LogoList({ logos, hidden = false }: LogoListProps) {
	return (
		<ul className="np-logos__list" aria-hidden={hidden ? "true" : undefined}>
			{logos.map((logo, index) => {
				const image = <img src={logo.url} alt={logo.alt} loading="lazy" decoding="async" />;
				return (
					<li className="np-logos__item" key={`${logo.url}-${index}`}>
						{logo.href ? (
							<a href={logo.href} tabIndex={hidden ? -1 : undefined}>
								{image}
							</a>
						) : (
							image
						)}
					</li>
				);
			})}
		</ul>
	);
}

/** Published logo cloud: a pure function, no state. The marquee only applies to the row layout. */
export function LogoCloudBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const content = readLogoCloudContent(block.content);
	const isMarquee = content.marquee && content.layout === "row" && content.logos.length > 0;
	const classes = [
		"wp-block-logo-cloud",
		`np-logos--${content.layout}`,
		content.grayscale ? "is-grayscale" : "",
		isMarquee ? "is-marquee" : "",
		className,
	]
		.filter(Boolean)
		.join(" ");
	const cssVars = { ...style, "--np-logo-h": content.logoHeight, "--np-logo-cols": content.columns } as React.CSSProperties;

	return (
		<div className={classes} style={cssVars} {...attributes}>
			{isMarquee ? (
				<div className="np-logos__track">
					<LogoList logos={content.logos} />
					<LogoList logos={content.logos} hidden />
				</div>
			) : (
				<LogoList logos={content.logos} />
			)}
		</div>
	);
}
