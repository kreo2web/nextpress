import type { JSX, ReactNode } from "react";
import { docsHeadingId } from "./docs-heading-id.js";

/**
 * One changelog entry, drawn the same way by the Update block and by the MDX `<Update>` tag: the label
 * (with the link id that "On this page" lists) and the description in a narrow column, the entry's
 * content beside them. Phones stack the two (`update-css.ts`). The id comes from the same function as a
 * docs heading's, so a link to the entry lands on it.
 */
export function UpdateView({ label, description, children }: { label: string; description: string; children?: ReactNode }): JSX.Element {
	const id = docsHeadingId(label);
	const shownDescription = description.trim();
	return (
		<div className="np-update">
			<div className="np-update__side">
				<h2 className="np-update__label" id={id}>
					{label.trim()}
					<a className="np-heading-anchor" href={`#${id}`} aria-label="Link to this entry">
						#
					</a>
				</h2>
				{shownDescription ? <p className="np-update__description">{shownDescription}</p> : null}
			</div>
			<div className="np-update__body">{children}</div>
		</div>
	);
}
