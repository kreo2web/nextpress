import React from "react";
import { Images } from "lucide-react";
import { DEFAULT_LOGO_CLOUD_CONTENT, readLogoCloudContent, type LogoCloudContent, type LogoItem } from "@shared/blocks/logo-cloud-model";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { LogoCloudSettings } from "./logo-cloud-settings";

type LogoListProps = { logos: LogoItem[]; hidden?: boolean };

/** Same markup as the published view; links never navigate while editing. */
function LogoList({ logos, hidden = false }: LogoListProps) {
  return (
    <ul className="np-logos__list" aria-hidden={hidden ? "true" : undefined}>
      {logos.map((logo, index) => {
        const image = <img src={logo.url} alt={logo.alt} loading="lazy" decoding="async" />;
        return (
          <li className="np-logos__item" key={`${logo.url}-${index}`}>
            {logo.href ? (
              <a href={logo.href} tabIndex={-1} onClick={(event) => event.preventDefault()}>
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

const LogoCloudBlock = createBlockDefinition<LogoCloudContent>({
  ...catalogMeta("core/logo-cloud"),
  icon: Images,
  defaultContent: DEFAULT_LOGO_CLOUD_CONTENT,
  parseContent: (raw) => readLogoCloudContent(raw),
  hasSettings: true,
  settings: LogoCloudSettings,
  render: ({ content, styles }) => {
    const isMarquee = content.marquee && content.layout === "row" && content.logos.length > 0;
    const classes = [
      "wp-block-logo-cloud",
      `np-logos--${content.layout}`,
      content.grayscale ? "is-grayscale" : "",
      isMarquee ? "is-marquee" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const cssVars = { ...styles, "--np-logo-h": content.logoHeight, "--np-logo-cols": content.columns } as React.CSSProperties;
    return (
      <div className={classes} style={cssVars}>
        {content.logos.length === 0 ? (
          <p className="text-center text-sm text-npb-text-muted">Add logos in the settings panel.</p>
        ) : isMarquee ? (
          <div className="np-logos__track">
            <LogoList logos={content.logos} />
            <LogoList logos={content.logos} hidden />
          </div>
        ) : (
          <LogoList logos={content.logos} />
        )}
      </div>
    );
  },
});

export default LogoCloudBlock;
