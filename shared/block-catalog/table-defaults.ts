const cell = (tag: "td" | "th", content: string) => ({ content, tag });
const row = (tag: "td" | "th", texts: string[]) => ({ cells: texts.map((text) => cell(tag, text)) });

/** A new table starts as 3 columns with a header row and two body rows. */
export const TABLE_DEFAULT_DATA = {
	head: [row("th", ["Header 1", "Header 2", "Header 3"])],
	body: [row("td", ["Cell 1", "Cell 2", "Cell 3"]), row("td", ["Cell 4", "Cell 5", "Cell 6"])],
	foot: [],
	hasFixedLayout: false,
	striped: false,
	bordered: true,
	compact: false,
	caption: "",
	className: "",
};
