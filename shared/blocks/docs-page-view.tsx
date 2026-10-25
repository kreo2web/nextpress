import * as React from "react";
import { Breadcrumbs, Pager, TocLinks } from "./docs-layout-view.js";
import type { DocsPageBound, DocsPageContent } from "./docs-page-model.js";

type DocsPageViewProps = {
	content: DocsPageContent;
	/** Null when the page wasn't bound: the content still shows, without title, contents or pager. */
	bound: DocsPageBound | null;
	/** The page's blocks, drawn by the caller (the published renderer or the editor canvas). */
	children: React.ReactNode;
	className?: string;
	style?: React.CSSProperties;
	attributes?: React.HTMLAttributes<HTMLDivElement>;
};

/**
 * One docs page: breadcrumbs, the page's own title and description, Copy page, the reading
 * column, previous/next and "On this page". Shared by the published renderer and the editor
 * canvas. On tablet and phone the contents list folds into a disclosure above the content.
 */
export function DocsPageView({ content, bound, children, className, style, attributes }: DocsPageViewProps) {
	const docs = bound?.docs;
	const headings = content.showToc ? (docs?.headings ?? []) : [];
	const hasToc = headings.length > 0;
	const crumbs = content.showBreadcrumbs ? (docs?.breadcrumbs ?? []) : [];
	const showPager = content.showPrevNext && Boolean(docs?.prev || docs?.next);
	const markdownPath = content.copyPage ? (docs?.markdownPath ?? "") : "";
	const title = content.showTitle ? (bound?.title ?? "") : "";
	const description = content.showDescription ? (bound?.description ?? "") : "";
	const classes = ["wp-block-docs-page", "np-dpage", hasToc ? "" : "np-dpage--no-toc", className].filter(Boolean).join(" ");

	return (
		<div className={classes} style={style} {...attributes}>
			<div className="np-dpage__main">
				{crumbs.length > 0 ? <Breadcrumbs crumbs={crumbs} /> : null}
				{title || markdownPath ? (
					<div className="np-dpage__head">
						{title ? <h1 className="np-dpage__title">{title}</h1> : null}
						{markdownPath ? (
							<div className="np-docs__toolbar">
								<button type="button" className="np-docs__action" data-np-docs-copy="" data-markdown={markdownPath}>
									<span className="np-docs__action-label" aria-live="polite">
										Copy page
									</span>
								</button>
								<a className="np-docs__action" href={markdownPath}>
									Open as markdown
								</a>
							</div>
						) : null}
					</div>
				) : null}
				{description ? <p className="np-dpage__description">{description}</p> : null}
				{hasToc ? (
					<details className="np-docs__toc-fold">
						<summary>On this page</summary>
						<nav aria-label="On this page">
							<TocLinks headings={headings} />
						</nav>
					</details>
				) : null}
				<div className="np-docs__content np-prose">{children}</div>
				{showPager ? <Pager prev={docs?.prev ?? null} next={docs?.next ?? null} /> : null}
			</div>
			{hasToc ? (
				<aside className="np-docs__toc">
					<nav aria-label="On this page">
						<p className="np-docs__toc-title" aria-hidden="true">
							On this page
						</p>
						<TocLinks headings={headings} />
					</nav>
				</aside>
			) : null}
		</div>
	);
}
