import * as React from "react";
import type { ElementExtras } from "./view-attributes.js";
import { tabElementIds, tabSlugs, type TabsLook } from "./tabs-model.js";

export type TabsViewTab = ElementExtras & {
	key: string;
	title: string;
	/** What the tab holds. */
	panel: React.ReactNode;
};

export type TabsViewProps = ElementExtras & {
	/** Makes the tab and panel ids; unique per Tabs on a page. */
	id: string;
	look: TabsLook;
	tabs: readonly TabsViewTab[];
	/** Which tab is open. The first, unless the caller keeps its own state. */
	selected?: number;
	/** Where React runs (editor, chat) clicking and arrow keys call this. On published pages `/vendor/tabs.js` does it. */
	onSelect?: (index: number) => void;
	/**
	 * Give every tab its own link name (`data-np-tab-slug`), so `/vendor/tabs.js` can put it in the
	 * address when a reader picks the tab and open the tab named in a shared link. Off unless asked:
	 * a code group is a preference that follows the reader, not a place to link to.
	 */
	linkable?: boolean;
	/** Extra classes on the outer element, after the block class (e.g. `np-code-group`). */
	extraClassName?: string;
	/** Attributes for the tab bar (the code group's sync and remember flags). */
	listAttributes?: Record<string, string | undefined>;
	/** Shown after the panels, inside them (blocks that aren't tabs). */
	after?: React.ReactNode;
};

/** One tab's panel. `ids` is left out for a tab found outside Tabs, which has no bar to open it. */
export function TabPanelView({
	ids,
	hidden,
	className,
	style,
	attributes,
	children,
}: ElementExtras & { ids?: { tab: string; panel: string }; hidden?: boolean; children?: React.ReactNode }): React.ReactElement {
	const classes = ["wp-block-tab", className].filter(Boolean).join(" ");
	if (!ids) {
		return (
			<div className={classes} style={style} {...attributes}>
				{children}
			</div>
		);
	}
	return (
		<div className={classes} style={style} {...attributes} role="tabpanel" id={ids.panel} aria-labelledby={ids.tab} tabIndex={0} hidden={hidden}>
			{children}
		</div>
	);
}

/**
 * The tab bar alone. The canvas of a code group draws it above its own child list; `TabsView`
 * draws it above the panels.
 */
export function TabsListView({
	id,
	titles,
	selected = 0,
	onSelect,
	listAttributes,
	slugs,
}: {
	id: string;
	titles: readonly string[];
	selected?: number;
	onSelect?: (index: number) => void;
	listAttributes?: Record<string, string | undefined>;
	/** One link name per tab, from `tabSlugs`. Left out when the tabs are not linkable. */
	slugs?: readonly string[];
}): React.ReactElement {
	const onKeyDown = (event: React.KeyboardEvent<HTMLElement>, index: number): void => {
		const target = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: titles.length - 1 }[event.key];
		if (target === undefined) return;
		event.preventDefault();
		const next = (target + titles.length) % titles.length;
		onSelect?.(next);
		(event.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
	};

	return (
		<div className="np-tabs__list" role="tablist" {...listAttributes}>
			{titles.map((title, index) => {
				const ids = tabElementIds({ tabsId: id, index });
				return (
					<button
						key={ids.tab}
						type="button"
						role="tab"
						className="np-tabs__tab"
						id={ids.tab}
						aria-controls={ids.panel}
						aria-selected={index === selected}
						tabIndex={index === selected ? 0 : -1}
						data-np-tab-slug={slugs?.[index]}
						onClick={
							onSelect
								? (event) => {
										event.stopPropagation();
										onSelect(index);
									}
								: undefined
						}
						onKeyDown={onSelect ? (event) => onKeyDown(event, index) : undefined}
					>
						{title}
					</button>
				);
			})}
		</div>
	);
}

/**
 * Tabs, the same markup for the Tabs block, the Code group block and the MDX `<Tabs>` tag, so
 * `TABS_CSS` and `/vendor/tabs.js` serve all of them. Pure: the caller keeps which tab is open.
 * With `linkable`, each tab button carries its link name, unique within this Tabs.
 */
export function TabsView({
	id,
	look,
	tabs,
	selected = 0,
	onSelect,
	linkable = false,
	extraClassName,
	listAttributes,
	after,
	className,
	style,
	attributes,
}: TabsViewProps): React.ReactElement {
	const titles = tabs.map((tab) => tab.title);
	return (
		<div
			className={["wp-block-tabs", `np-tabs--${look}`, extraClassName, className].filter(Boolean).join(" ")}
			style={style}
			{...attributes}
			data-np-tabs=""
		>
			<TabsListView
				id={id}
				titles={titles}
				selected={selected}
				onSelect={onSelect}
				listAttributes={listAttributes}
				slugs={linkable ? tabSlugs(titles) : undefined}
			/>
			<div className="np-tabs__panels">
				{tabs.map((tab, index) => (
					<TabPanelView
						key={tab.key}
						ids={tabElementIds({ tabsId: id, index })}
						hidden={index !== selected}
						className={tab.className}
						style={tab.style}
						attributes={tab.attributes}
					>
						{tab.panel}
					</TabPanelView>
				))}
				{after}
			</div>
		</div>
	);
}
