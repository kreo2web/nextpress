import { describe, expect, it } from "vitest";
import type { BlockConfig } from "../schema-types.js";
import { docsHeadingId } from "../blocks/docs-heading-id.js";
import { blocksToMarkdown } from "./blocks-to-markdown.js";
import { extractPageText } from "./page-text.js";

const diagram: BlockConfig = {
	id: "d1",
	name: "docs/diagram",
	type: "block",
	parentId: null,
	content: { kind: "structured", data: { code: "flowchart LR\n  A --> B", caption: "Flow" } },
	styles: {},
	settings: {},
};

const paragraph = (id: string, text: string): BlockConfig => ({
	id,
	name: "docs/text",
	type: "block",
	parentId: "u1",
	content: { kind: "structured", data: { text } },
	styles: {},
	settings: {},
});

const update: BlockConfig = {
	id: "u1",
	name: "docs/update",
	type: "container",
	parentId: null,
	content: { kind: "structured", data: { label: "October 2026", description: "Two things" } },
	styles: {},
	settings: {},
	children: [{ ...diagram, id: "d2", parentId: "u1" }, paragraph("p1", "Body text.")],
};

describe("a diagram in the markdown copy and the search text", () => {
	it("is copied as its Mermaid fence, with the caption as the fence's title", () => {
		expect(blocksToMarkdown([diagram])).toBe('```mermaid title="Flow"\nflowchart LR\n  A --> B\n```\n');
	});

	it("is searchable by its Mermaid text", () => {
		const page = extractPageText([diagram]);
		expect(page.text).toContain("flowchart LR");
		expect(page.text).toContain("A --> B");
		expect(page.text).toContain("Flow");
	});
});

describe("a changelog entry in the markdown copy and the search text", () => {
	it("is copied as a heading with its label, then its description and blocks", () => {
		expect(blocksToMarkdown([update])).toBe('## October 2026\n\nTwo things\n\n```mermaid title="Flow"\nflowchart LR\n  A --> B\n```\n\nBody text.\n');
	});

	it("is a section of the search text under its label, so a hit links to it", () => {
		const page = extractPageText([update]);
		expect(page.headings).toContainEqual({ text: "October 2026", id: docsHeadingId("October 2026"), depth: 2 });
		const section = page.sections.find((candidate) => candidate.id === docsHeadingId("October 2026"));
		expect(section?.heading).toBe("October 2026");
		expect(section?.text).toContain("Body text.");
	});
});
