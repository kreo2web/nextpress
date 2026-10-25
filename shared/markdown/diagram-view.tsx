import { useEffect, useState, type JSX } from "react";

/** Turns diagram text into SVG markup, or throws with a reason. The server passes Pele's synchronous `render`. */
export type DiagramRenderer = (source: string) => string;

/**
 * Pele's options, fixed here and never taken from the diagram: links get `nofollow`, and the
 * source and output limits stay at Pele's defaults. Pele escapes diagram text and blocks
 * `javascript:` / `data:` links itself.
 */
export const DIAGRAM_RENDER_OPTIONS = { linkRel: "noopener nofollow" } as const;

type DiagramState = { svg: string; error: null } | { svg: null; error: string } | { svg: null; error: null };

const readError = (error: unknown): string =>
	error instanceof Error && error.message ? error.message : "This diagram couldn't be drawn.";

/** Renders on the server when it can; otherwise loads Pele in the browser, only for pages that have a diagram. */
const useDiagram = ({ source, render }: { source: string; render?: DiagramRenderer }): DiagramState => {
	const [state, setState] = useState<DiagramState>(() => {
		if (!render) return { svg: null, error: null };
		try {
			return { svg: render(source), error: null };
		} catch (error) {
			return { svg: null, error: readError(error) };
		}
	});

	useEffect(() => {
		if (render) return undefined;
		let cancelled = false;
		import("pele/lazy")
			.then(({ renderAsync }) => renderAsync(source, DIAGRAM_RENDER_OPTIONS))
			.then((result) => {
				if (!cancelled) setState({ svg: result.svg, error: null });
			})
			.catch((error: unknown) => {
				if (!cancelled) setState({ svg: null, error: readError(error) });
			});
		return () => {
			cancelled = true;
		};
	}, [source, render]);

	return state;
};

/** What a reader sees in place of a diagram that can't be drawn. The library's own reason is left out: it names internals, and the text below shows what to fix. */
const DIAGRAM_ERROR_MESSAGE = "This diagram couldn't be drawn. Check the text below for a typo or a missing arrow.";

/**
 * A Mermaid diagram (a ```` ```mermaid ```` fence, or a docs diagram block) drawn as SVG by Pele, with an
 * optional caption under it. If the text has a mistake, the reader sees a plain message and the diagram
 * text instead of a broken page.
 */
export function DiagramView({ source, render, caption }: { source: string; render?: DiagramRenderer; caption?: string | null }): JSX.Element {
	const state = useDiagram({ source, render });
	if (state.error !== null) {
		return (
			<figure className="np-diagram np-diagram-error">
				<figcaption>{DIAGRAM_ERROR_MESSAGE}</figcaption>
				<pre>{source}</pre>
			</figure>
		);
	}
	if (state.svg === null) return <figure className="np-diagram np-diagram-loading" aria-busy="true" />;
	const shownCaption = caption?.trim() ?? "";
	return (
		<figure className="np-diagram">
			<div className="np-diagram__picture" role="img" aria-label="Diagram" dangerouslySetInnerHTML={{ __html: state.svg }} />
			{shownCaption ? <figcaption>{shownCaption}</figcaption> : null}
		</figure>
	);
}
