import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { BADGE_LOOKS, BADGE_TONES } from "../../blocks/badge-model.js";
import type { CalloutType } from "../../blocks/callout-model.js";
import { CODE_EXAMPLE_LAYOUTS, type CodeExampleLayout } from "../../blocks/code-example-model.js";
import { CodeExampleView } from "../../blocks/code-example-view.js";
import { FileTreeView } from "../../blocks/file-tree-view.js";
import { ParamView } from "../../blocks/params-view.js";
import { readChoice } from "../../blocks/read-structured.js";
import { Callout } from "../callout.js";
import { docProp, type DocComponentView, type LeafDocName } from "../doc-component-props.js";

/** `<Note>`, `<Tip>`… are other docs tools' names for a callout of one type. */
const calloutOf =
	(type: CalloutType): DocComponentView =>
	({ title, children }) => (
		<Callout type={type} title={docProp(title)}>
			{children}
		</Callout>
	);

const textOfChildren = (children: ReactNode): string =>
	Children.toArray(children)
		.map((child) => (typeof child === "string" || typeof child === "number" ? String(child) : ""))
		.join("");

type FenceProps = { node?: { tagName?: string } };

/** A fenced code block among an `<Example>`'s children: the renderer hands it over as a `<pre>`. */
const isCodeFence = (child: ReactNode): child is ReactElement<FenceProps> =>
	isValidElement<FenceProps>(child) && (child.type === "pre" || child.props.node?.tagName === "pre");

/** The first fenced code is the code; everything after it is what it makes. */
const splitExample = (children: ReactNode): { code: ReactNode; result: ReactNode[] } => {
	const parts = Children.toArray(children);
	const codeIndex = parts.findIndex(isCodeFence);
	if (codeIndex === -1) return { code: null, result: parts };
	return { code: parts[codeIndex], result: parts.filter((_, index) => index !== codeIndex) };
};

/** How each standalone tag draws, keyed by the name authors write. */
export const LEAF_DOC_VIEWS: Record<LeafDocName, DocComponentView> = {
	Callout: ({ type, title, children }) => (
		<Callout type={docProp(type)} title={docProp(title)}>
			{children}
		</Callout>
	),
	Note: calloutOf("note"),
	Tip: calloutOf("tip"),
	Warning: calloutOf("warning"),
	Danger: calloutOf("danger"),
	Info: calloutOf("note"),
	Check: calloutOf("success"),
	FileTree: ({ children }) => <FileTreeView tree={textOfChildren(children)} />,
	Param: ({ name, type, default: defaultValue, required, children }) => (
		<ParamView name={docProp(name) ?? ""} type={docProp(type)} defaultValue={docProp(defaultValue)} required={docProp(required) === "true"}>
			{children}
		</ParamView>
	),
	Example: ({ layout, children }) => {
		const { code, result } = splitExample(children);
		return <CodeExampleView layout={readChoice<CodeExampleLayout>({ value: docProp(layout), options: CODE_EXAMPLE_LAYOUTS, fallback: "side" })} code={code} result={result} />;
	},
	Kbd: ({ children }) => <kbd className="np-kbd">{children}</kbd>,
	Badge: ({ tone, look, children }) => (
		<span
			className={`np-badge np-badge--${readChoice({ value: docProp(look), options: BADGE_LOOKS, fallback: "soft" })}`}
			data-tone={readChoice({ value: docProp(tone), options: BADGE_TONES, fallback: "accent" })}>
			{children}
		</span>
	),
};
