import { Fragment, type JSX, type ReactNode } from "react";
import { safeHref } from "./safe-href.js";
import { parseInlineMarkdown } from "./inline-text.js";
import type { MarkdownNode } from "./parse-markdown.js";
import { nodeText } from "./plain-text.js";

const renderNodes = (nodes: MarkdownNode[]): ReactNode =>
	nodes.map((node, index) => {
		const inner = (): ReactNode => renderNodes(node.children ?? []);
		switch (node.type) {
			case "text":
				return <Fragment key={index}>{node.value}</Fragment>;
			case "strong":
				return <strong key={index}>{inner()}</strong>;
			case "emphasis":
				return <em key={index}>{inner()}</em>;
			case "delete":
				return <del key={index}>{inner()}</del>;
			case "inlineCode":
				return (
					<code key={index} className="np-inline-code">
						{node.value}
					</code>
				);
			case "break":
				return <br key={index} />;
			case "link": {
				const href = safeHref(node.url);
				return href ? (
					<a key={index} href={href}>
						{inner()}
					</a>
				) : (
					<Fragment key={index}>{inner()}</Fragment>
				);
			}
			default:
				return <Fragment key={index}>{nodeText(node)}</Fragment>;
		}
	});

/**
 * Inline markdown as React: bold, italic, strike, code and links only; everything else shows as
 * its words. Never injects HTML, and links pass the same safety check as MDX links.
 */
export function InlineMarkdown({ source }: { source: string }): JSX.Element {
	return <>{renderNodes(parseInlineMarkdown(source))}</>;
}
