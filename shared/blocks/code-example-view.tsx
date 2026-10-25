import type { JSX, ReactNode } from "react";
import type { CodeExampleLayout } from "./code-example-model.js";

/**
 * Code beside what it makes: a "Code" pane and a "Result" pane. Side by side when there is room
 * and the layout says so, always stacked on phones (CSS). Pure: the page, MDX `<Example>` and the
 * editor's static views share it. Without code, only the result shows.
 */
export function CodeExampleView({ layout = "side", code, result }: { layout?: CodeExampleLayout; code?: ReactNode; result?: ReactNode }): JSX.Element {
	return (
		<div className="np-example" data-layout={layout}>
			{code ? (
				<div className="np-example-pane np-example-code" role="group" aria-label="Code">
					<div className="np-example-label">Code</div>
					{code}
				</div>
			) : null}
			<div className="np-example-pane np-example-result" role="group" aria-label="Result">
				<div className="np-example-label">Result</div>
				{result}
			</div>
		</div>
	);
}
