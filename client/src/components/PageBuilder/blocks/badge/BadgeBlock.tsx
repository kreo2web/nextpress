import React from "react";
import { Tag } from "lucide-react";
import { DEFAULT_BADGE_CONTENT, readBadgeContent, type BadgeContent } from "@shared/blocks/badge-model";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { BadgeSettings } from "./badge-settings";

/** The same markup the published badge renders, so `BADGE_CSS` styles both. */
function BadgeView({ content, styles }: { content: BadgeContent; styles?: React.CSSProperties }) {
  return (
    <div className="wp-block-badge" style={styles}>
      <span className={`np-badge np-badge--${content.look}`} data-tone={content.tone}>
        {content.text}
      </span>
    </div>
  );
}

const BadgeBlock = createBlockDefinition<BadgeContent>({
  ...catalogMeta("core/badge"),
  icon: Tag,
  defaultContent: DEFAULT_BADGE_CONTENT,
  parseContent: (raw) => readBadgeContent(raw),
  settings: BadgeSettings,
  hasSettings: true,
  render: ({ content, styles }) => <BadgeView content={content} styles={styles} />,
});

export default BadgeBlock;
