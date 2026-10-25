import { describe, expect, it } from "vitest";
import { MAX_FILE_TREE_DEPTH, MAX_FILE_TREE_LINES, parseFileTree, readFileTreeContent } from "./file-tree-model.js";

describe("parseFileTree", () => {
	it("nests entries by two spaces per level", () => {
		const tree = parseFileTree("src/\n  app.ts\n  routes/\n    index.ts\npackage.json");
		expect(tree.map((entry) => entry.name)).toEqual(["src", "package.json"]);
		expect(tree[0].children.map((entry) => entry.name)).toEqual(["app.ts", "routes"]);
		expect(tree[0].children[1].children.map((entry) => entry.name)).toEqual(["index.ts"]);
	});

	it("reads a trailing slash as a folder and anything else as a file", () => {
		const [folder, file] = parseFileTree("docs/\nreadme.md");
		expect(folder).toMatchObject({ name: "docs", kind: "folder" });
		expect(file).toMatchObject({ name: "readme.md", kind: "file" });
	});

	it("treats an entry with children as a folder even without the slash", () => {
		const [entry] = parseFileTree("src\n  app.ts");
		expect(entry.kind).toBe("folder");
	});

	it("reads a trailing star as highlight and # as a note", () => {
		const [entry] = parseFileTree("app.ts *  # the entry point");
		expect(entry).toMatchObject({ name: "app.ts", highlight: true, note: "the entry point" });
		const [plain] = parseFileTree("C#.md");
		expect(plain).toMatchObject({ name: "C#.md", highlight: false, note: "" });
	});

	it("counts a tab as two spaces and rounds an uneven indent", () => {
		const tabbed = parseFileTree("a/\n\tb");
		expect(tabbed[0].children[0].name).toBe("b");
		const uneven = parseFileTree("a/\n   b\n     c");
		expect(uneven[0].children[0].name).toBe("b");
		expect(uneven[0].children[0].children[0].name).toBe("c");
	});

	it("skips blank and nameless lines and never throws on junk", () => {
		expect(parseFileTree("")).toEqual([]);
		expect(parseFileTree("\n   \n# only a note\n/\n")).toEqual([]);
		expect(() => parseFileTree("\u0000￿<>{}\n    \n  ***")).not.toThrow();
	});

	it("attaches a line indented too deep to the nearest parent", () => {
		const [root] = parseFileTree("a/\n        deep.ts");
		expect(root.children.map((entry) => entry.name)).toEqual(["deep.ts"]);
	});

	it("stops at the depth and line caps", () => {
		const lines = Array.from({ length: 30 }, (_, index) => `${"  ".repeat(index)}d${index}/`).join("\n");
		let depth = 0;
		let node = parseFileTree(lines)[0];
		while (node) {
			depth++;
			node = node.children[0];
		}
		expect(depth).toBe(MAX_FILE_TREE_DEPTH);
		const long = Array.from({ length: MAX_FILE_TREE_LINES + 100 }, (_, index) => `f${index}`).join("\n");
		expect(parseFileTree(long)).toHaveLength(MAX_FILE_TREE_LINES);
	});
});

describe("readFileTreeContent", () => {
	it("falls back to the starter tree for content that isn't a tree", () => {
		expect(readFileTreeContent(undefined).tree).toContain("package.json");
		expect(readFileTreeContent({ kind: "structured", data: { tree: "a/" } }).tree).toBe("a/");
	});
});
