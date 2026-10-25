import * as React from "react";
import { docsElementIds } from "./docs-layout-model.js";
import { MenuIcon, NavList } from "./docs-layout-view.js";
import type { DocsShellBound, DocsShellButton, DocsShellLink } from "./docs-shell-model.js";

/** Only web, mail and on-site addresses become links; anything else (a script address) is dropped. */
const SAFE_LINK = /^(https?:\/\/|mailto:|\/|#)/i;
export const isSafeShellLink = (url: string): boolean => SAFE_LINK.test(url.trim());

const SearchIcon = () => (
	<svg className="np-search__icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<circle cx="11" cy="11" r="7" />
		<path d="m20 20-3.5-3.5" />
	</svg>
);

const ShellLinks = ({ links, className }: { links: DocsShellLink[]; className: string }) => {
	const safe = links.filter((link) => isSafeShellLink(link.url));
	if (safe.length === 0) return null;
	return (
		<nav className={className} aria-label="Docs links">
			{safe.map((link) => (
				<a key={`${link.label}-${link.url}`} href={link.url} className="np-dshell__link">
					{link.label}
				</a>
			))}
		</nav>
	);
};

/** The one button in the top bar (for example "Get started"); empty or unsafe means none. */
const ShellButton = ({ button, className }: { button: DocsShellButton | undefined; className: string }) => {
	if (!button || !button.label || !isSafeShellLink(button.url)) return null;
	return (
		<a className={className} href={button.url}>
			{button.label}
		</a>
	);
};

type DocsShellViewProps = {
	blockId: string;
	/** Null when the page wasn't bound: the page still shows, without top bar details or sidebar. */
	bound: DocsShellBound | null;
	/** The docs page, drawn by the caller (the published renderer or the editor canvas). */
	children: React.ReactNode;
	/** Editor only: whether the phone drawer is open. Published pages let `docs.js` flip this. */
	menuOpen?: boolean;
	onMenuClick?: () => void;
	className?: string;
	style?: React.CSSProperties;
	attributes?: React.HTMLAttributes<HTMLDivElement>;
};

/**
 * The docs shell's markup: top bar (brand, search, links, one button), sidebar of pages, and the
 * page in the middle. Shared by the published renderer and the editor canvas so one stylesheet
 * serves both. No state: `/vendor/docs.js` runs the phone drawer and `/vendor/search.js` opens
 * search from the `data-np-search-open` button.
 *
 * A dark logo is drawn next to the light one and swapped by CSS on pages that say they are dark
 * (`.dark` or `data-theme="dark"` above the frame); published pages have no dark switch of their own.
 */
export function DocsShellView({ blockId, bound, children, menuOpen = false, onMenuClick, className, style, attributes }: DocsShellViewProps) {
	const ids = docsElementIds(blockId);
	const settings = bound?.settings;
	const tree = bound?.tree ?? [];
	const hasNav = tree.length > 0;
	const links = settings?.links ?? [];
	const search = settings?.search;
	const brandTitle = bound?.brandTitle ?? "";
	const hasDarkLogo = Boolean(settings?.logoUrl && settings.logoDarkUrl);
	const classes = ["wp-block-docs-shell", "np-dshell", hasNav ? "" : "np-dshell--no-nav", hasDarkLogo ? "np-dshell--dark-logo" : "", className].filter(Boolean).join(" ");
	const brandInner = (
		<>
			{settings?.logoUrl ? <img className="np-dshell__logo np-dshell__logo--light" src={settings.logoUrl} alt="" /> : null}
			{settings?.logoDarkUrl ? <img className="np-dshell__logo np-dshell__logo--dark" src={settings.logoDarkUrl} alt="" /> : null}
			<span className="np-dshell__title">{brandTitle}</span>
		</>
	);

	return (
		<div className={classes} style={style} {...attributes} data-np-docs="" data-menu-open={menuOpen ? "true" : "false"}>
			<header className="np-dshell__bar">
				{hasNav ? (
					<button type="button" className="np-docs__menu" data-np-docs-menu="" aria-expanded={menuOpen} aria-controls={ids.nav} onClick={onMenuClick}>
						<MenuIcon />
						Menu
					</button>
				) : null}
				{brandTitle || settings?.logoUrl ? (
					bound?.brandPath ? (
						<a className="np-dshell__brand" href={bound.brandPath}>
							{brandInner}
						</a>
					) : (
						<span className="np-dshell__brand">{brandInner}</span>
					)
				) : null}
				{search?.show ? (
					<button type="button" className="np-search np-dshell__search" data-np-search-open="" data-placeholder={search.placeholder} aria-haspopup="dialog" aria-label={search.label}>
						<SearchIcon />
						<span className="np-search__label">{search.label}</span>
						<kbd className="np-search__kbd" data-np-search-kbd="" aria-hidden="true">
							Ctrl K
						</kbd>
					</button>
				) : null}
				<div className="np-dshell__end">
					<ShellLinks links={links} className="np-dshell__links" />
					<ShellButton button={settings?.button} className="np-dshell__button" />
				</div>
			</header>
			<div className="np-dshell__body">
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
							<ShellLinks links={links} className="np-dshell__drawer-links" />
							<ShellButton button={settings?.button} className="np-dshell__button np-dshell__button--drawer" />
						</aside>
					</>
				) : null}
				<div className="np-dshell__main">{children}</div>
			</div>
		</div>
	);
}
