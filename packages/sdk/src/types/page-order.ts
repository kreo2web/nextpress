/** One page's place in the menu order. Lower numbers come first. */
export type PageOrderItem = {
	id: string;
	menuOrder: number;
};

/** Input for `pages.reorder`. */
export type ReorderPagesInput = {
	items: PageOrderItem[];
	/** Site the pages are on. Default: the client's site. */
	siteId?: string;
};

export type ReorderPagesResult = {
	ok: true;
	updated: number;
};
