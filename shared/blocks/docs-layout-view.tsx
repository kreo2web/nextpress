import * as React from "react";
import { docsElementIds, type DocsBound, type DocsCrumb, type DocsLayoutContent, type DocsLink, type DocsNavItem } from "./docs-layout-model.js";

const NavList = ({ items }: { items: DocsNavItem[] }) => (
	<ul className="np-docs__list">
		{items.map((item) => (
			<li key={item.id}>
				{item.path ? (
					<a className="np-docs__link" href={item.path} aria-current={item.isCurrent ? "page" : undefined}>
						{item.title}
					</a>
				) : (
					<span className="np-docs__group">{item.title}</span>
				)}
				{item.children.length > 0 ? <NavList items={item.children} /> : null}
			</li>
		))}
	</ul>
);

const Breadcrumbs = ({ crumbs }: { crumbs: DocsCrumb[] }) => (
	<nav className="np-docs__crumbs" aria-label="Breadcrumb">
		<ol>
			{crumbs.map((crumb, index) => {
				const last = index === crumbs.length - 1;
				return (
					<li key={`${index}-${crumb.title}`}>
						{last ? (
							<span aria-current="page">{crumb.title}</span>
						) : crumb.path ? (
							<a href={crumb.path}>{crumb.title}</a>
						) : (
							<span>{crumb.title}</span>
						)}
					</li>
				);
			})}
		</ol>
	</nav>
);

const Pager = ({ prev, next }: { prev: DocsLink | null; next: DocsLink | null }) => (
	<nav className="np-docs__pager" aria-label="Previous and next pages">
		{prev ? (
			<a className="np-docs__pager-link np-docs__pager-link--prev" href={prev.path} rel="prev">
				<span className="np-docs__pager-hint">Previous</span>
				<span className="np-docs__pager-title">{prev.title}</span>
			</a>
		) : null}
		{next ? (
			<a className="np-docs__pager-link np-docs__pager-link--next" href={next.path} rel="next">
				<span className="np-docs__pager-hint">Next</span>
				<span className="np-docs__pager-title">{next.title}</span>
			</a>
		) : null}
	</nav>
);

const TocLinks = ({ headings }: { headings: DocsBound["headings"] }) => (
	<ul className="np-docs__toc-list">
		{headings.map((heading, index) => (
			<li key={`${heading.id}-${index}`} className={`np-docs__toc-item np-docs__toc-item--h${heading.level}`}>
				<a href={`#${heading.id}`}>{heading.text}</a>
			</li>
		))}
	</ul>
);

const MenuIcon = () => (
	<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
		<path d="M4 7h16M4 12h16M4 17h16" />
	</svg>
);

type DocsLayoutViewProps = {
	blockId: string;
	content: DocsLayoutContent;
	/** Null when the page wasn't bound: the content still shows, without sidebar, pager or contents. */
	bound: DocsBound | null;
	/** The page's content, drawn by the caller (the published renderer or the editor canvas). */
	children: React.ReactNode;
	/** Editor only: whether the phone drawer is open. Published pages let `docs.js` flip this. */
	menuOpen?: boolean;
	onMenuClick?: () => void;
	className?: string;
	style?: React.CSSProperties;
	attributes?: Record<string, unknown>;
};

/**
 * The docs layout's markup, shared by the published renderer and the editor canvas so one
 * stylesheet serves both. No state: on a published page `/vendor/docs.js` opens the phone drawer,
 * highlights the heading being read and copies the page.
 */
export function DocsLayoutView({ blockId, content, bound, children, menuOpen = false, onMenuClick, className, style, attributes }: DocsLayoutViewProps) {
	const ids = docsElementIds(blockId);
	const tree = bound?.tree ?? [];
	const headings = content.showToc ? (bound?.headings ?? []) : [];
	const hasNav = tree.length > 0;
	const hasToc = headings.length > 0;
	const crumbs = content.showBreadcrumbs ? (bound?.breadcrumbs ?? []) : [];
	const showPager = content.showPrevNext && Boolean(bound?.prev || bound?.next);
	const markdownPath = content.copyPage ? (bound?.markdownPath ?? "") : "";
	const classes = ["wp-block-docs-layout", "np-docs", hasNav ? "" : "np-docs--no-nav", hasToc ? "" : "np-docs--no-toc", className].filter(Boolean).join(" ");

	return (
		<div className={classes} style={style} {...attributes} data-np-docs="" data-menu-open={menuOpen ? "true" : "false"}>
			{hasNav ? (
				<>
					<div className="np-docs__backdrop" data-np-docs-backdrop="" aria-hidden="true" />
					<aside className="np-docs__sidebar" id={ids.nav} data-np-docs-drawer="">
						<button type="button" className="np-docs__close" data-np-docs-close="" onClick={onMenuClick}>
							Close
						</button>
						<nav aria-label="Docs">
							<NavList items={tree} />
						</nav>
					</aside>
				</>
			) : null}
			<div className="np-docs__main">
				{hasNav ? (
					<div className="np-docs__bar">
						<button type="button" className="np-docs__menu" data-np-docs-menu="" aria-expanded={menuOpen} aria-controls={ids.nav} onClick={onMenuClick}>
							<MenuIcon />
							Menu
						</button>
					</div>
				) : null}
				{crumbs.length > 0 ? <Breadcrumbs crumbs={crumbs} /> : null}
				{hasToc ? (
					<details className="np-docs__toc-fold">
						<summary>On this page</summary>
						<nav aria-label="On this page">
							<TocLinks headings={headings} />
						</nav>
					</details>
				) : null}
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
				<div className="np-docs__content">{children}</div>
				{showPager ? <Pager prev={bound?.prev ?? null} next={bound?.next ?? null} /> : null}
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
