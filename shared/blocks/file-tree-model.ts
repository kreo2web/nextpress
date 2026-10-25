import type { BlockContent } from "../schema-types.js";
import { readStructuredData, readText } from "./read-structured.js";

export const FILE_TREE_BLOCK_NAME = "docs/file-tree";

/** One file or folder in a drawn tree. */
export type FileTreeEntry = {
	name: string;
	kind: "folder" | "file";
	/** Drawn stronger, for "the file this guide is about". */
	highlight: boolean;
	/** A short note after the name (`# the entry point` in the text). */
	note: string;
	children: FileTreeEntry[];
};

/**
 * A folder and file tree, written as text: one line per entry, two spaces per level, a folder ends
 * with `/`, a ` *` at the end highlights the line and `# words` adds a note. The MDX `<FileTree>`
 * turns its markdown list into the same lines, so both draw through one parser.
 */
export type FileTreeContent = { tree: string };

export const DEFAULT_FILE_TREE_CONTENT: FileTreeContent = {
	tree: ["src/", "  app.ts *  # the entry point", "  routes/", "    index.ts", "package.json"].join("\n"),
};

export function readFileTreeContent(content: BlockContent | undefined): FileTreeContent {
	return { tree: readText(readStructuredData(content).tree, DEFAULT_FILE_TREE_CONTENT.tree) };
}

/** More than this and the rest is ignored; a tree this deep or long is better split into several. */
export const MAX_FILE_TREE_DEPTH = 12;
export const MAX_FILE_TREE_LINES = 500;

type ParsedLine = { level: number; entry: FileTreeEntry };

/** One line as an entry, or null when it holds no name. Never throws. */
const parseLine = (line: string): ParsedLine | null => {
	const spaced = line.replace(/\t/g, "  ").replace(/\s+$/, "");
	const indent = spaced.length - spaced.trimStart().length;
	const body = spaced.trimStart();
	const hashAt = body.search(/(^|\s)#(\s|$)/);
	const note = hashAt === -1 ? "" : body.slice(hashAt).replace(/^\s*#\s?/, "").trim();
	let name = (hashAt === -1 ? body : body.slice(0, hashAt)).trim();
	const highlight = /(^|\s)\*$/.test(name);
	if (highlight) name = name.replace(/\s*\*$/, "").trim();
	const isFolder = name.endsWith("/");
	if (isFolder) name = name.replace(/\/+$/, "").trim();
	if (!name) return null;
	return { level: Math.round(indent / 2), entry: { name, kind: isFolder ? "folder" : "file", highlight, note, children: [] } };
};

/**
 * The tree a block's text describes. Lenient on purpose: blank lines are skipped, tabs count as two
 * spaces, an uneven indent rounds to the nearest level, and a line indented deeper than its
 * parent allows is attached as that parent's next child. An entry with children is a folder,
 * with or without the trailing `/`.
 *
 * WHY: authors paste trees from terminals and other docs; a stray space must not lose the page.
 */
export function parseFileTree(text: string): FileTreeEntry[] {
	const roots: FileTreeEntry[] = [];
	const parents: FileTreeEntry[] = [];
	text
		.split("\n")
		.slice(0, MAX_FILE_TREE_LINES)
		.map(parseLine)
		.filter((line): line is ParsedLine => line !== null)
		.forEach(({ level, entry }) => {
			const depth = Math.min(level, parents.length, MAX_FILE_TREE_DEPTH - 1);
			parents.length = depth;
			const parent = parents[depth - 1];
			if (parent) {
				parent.kind = "folder";
				parent.children.push(entry);
			} else roots.push(entry);
			parents.push(entry);
		});
	return roots;
}
