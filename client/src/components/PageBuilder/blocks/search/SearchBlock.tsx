import React from "react";
import { Search } from "lucide-react";
import { DEFAULT_SEARCH_CONTENT, readSearchContent, type SearchContent } from "@shared/blocks/search-model";
import { SearchButtonView } from "@shared/blocks/search-view";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { SearchSettings } from "./search-settings";

/** The editor shows the button only; the search window exists on published pages. */
const SearchBlock = createBlockDefinition<SearchContent>({
  ...catalogMeta("core/search"),
  icon: Search,
  defaultContent: DEFAULT_SEARCH_CONTENT,
  parseContent: (raw) => readSearchContent(raw),
  settings: SearchSettings,
  hasSettings: true,
  render: ({ content, styles }) => (
    <div className="wp-block-search" style={styles}>
      <SearchButtonView content={content} />
    </div>
  ),
});

export default SearchBlock;
