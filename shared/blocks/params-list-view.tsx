import type { JSX } from "react";
import { MarkdownView } from "../markdown/markdown-view.js";
import { shownParams, type ParamItem } from "./params-model.js";
import { ParamView } from "./params-view.js";

/**
 * The parameters block's list: each item through `ParamView`, its description as small markdown.
 * Kept apart from `params-view.tsx` because the markdown view itself draws `<Param>` tags.
 */
export function ParamsListView({ items }: { items: ParamItem[] }): JSX.Element {
	return (
		<div className="np-params">
			{shownParams(items).map((item, index) => (
				<ParamView key={`${item.name}-${index}`} name={item.name} type={item.type} defaultValue={item.default} required={item.required}>
					{item.description ? <MarkdownView text={item.description} mode="static" className="np-prose-compact" /> : null}
				</ParamView>
			))}
		</div>
	);
}
