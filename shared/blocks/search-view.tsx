import * as React from "react";
import type { SearchContent } from "./search-model.js";

/**
 * The search button inside a block's wrapper (`.wp-block-search`, set by the caller), the same markup in the editor and on the published page, so `SEARCH_CSS`
 * styles both. On a published page `/vendor/search.js` opens the search window when it is pressed
 * (or on Ctrl/⌘ + K) and swaps "Ctrl" for "⌘" on Apple devices; the editor just shows the button.
 */
export function SearchButtonView({ content }: { content: SearchContent }) {
	return (
		<button type="button" className="np-search" data-np-search="" data-placeholder={content.placeholder} aria-haspopup="dialog">
			<svg className="np-search__icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
				<circle cx="11" cy="11" r="7" />
				<path d="m20 20-3.5-3.5" />
			</svg>
			<span className="np-search__label">{content.label}</span>
			<kbd className="np-search__kbd" data-np-search-kbd="" aria-hidden="true">
				Ctrl K
			</kbd>
		</button>
	);
}
