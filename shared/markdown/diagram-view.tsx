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

/**
 * A Mermaid diagram (a ```` ```mermaid ```` fence) drawn as SVG by Pele. If the text has a
 * mistake, the reader sees the reason and the diagram text instead of a broken page.
 */
export function DiagramView({ source, render }: { source: string; render?: DiagramRenderer }): JSX.Element {
	const state = useDiagram({ source, render });
	if (state.error !== null) {
		return (
			<figure className="np-diagram np-diagram-error">
				<figcaption>{`This diagram couldn't be drawn: ${state.error}`}</figcaption>
				<pre>{source}</pre>
			</figure>
		);
	}
	if (state.svg === null) return <figure className="np-diagram np-diagram-loading" aria-busy="true" />;
	return <figure className="np-diagram" role="img" aria-label="Diagram" dangerouslySetInnerHTML={{ __html: state.svg }} />;
}
