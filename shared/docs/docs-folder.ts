import { mdxToBlocks } from "../mdx-blocks/index.js";
import type { DocsItemKind } from "./types.js";

/**
 * A docs written as a folder of Markdown files, read into the docs it describes. Pure: the caller
 * reads the files; this decides what they mean, so one set of rules serves the import script now
 * and any import screen later.
 *
 * The folder's shape:
 * - `index.md` is the docs home; its title names the docs and its slug is the docs' address.
 * - Any other `.md` file is a page; a folder is a group, named by its `_group.md`.
 * - Each file starts with front matter: `title`, `description`, `slug`, `kind` and `order`.
 */

/** One file of the folder: its path inside the folder (`guides/install.md`) and its text. */
export type DocsFolderFile = { path: string; text: string };

export type DocsFolderItem = {
	title: string;
	description: string;
	slug: string;
	kind: DocsItemKind;
	order: number;
	/** The page's MDX; empty for a group. */
	mdx: string;
	/** The file it came from, so problems and progress name it. */
	source: string;
	children: DocsFolderItem[];
};

export type DocsFolderProblem = { source: string; message: string; line: number | null };

export type DocsFolderPlan = { ok: true; home: DocsFolderItem; count: number } | { ok: false; problems: DocsFolderProblem[] };

const GROUP_FILE = "_group.md";
const HOME_FILE = "index.md";

type FrontMatter = { fields: Record<string, string>; body: string; bodyLine: number };

/** `key: value` lines between `---` fences; values may be quoted. Null when the file has none. */
function readFrontMatter(text: string): FrontMatter | null {
	const match = text.replace(/^﻿/, "").match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!match) return null;
	const fields = Object.fromEntries(
		match[1]
			.split(/\r?\n/)
			.map((line) => line.match(/^([A-Za-z][\w-]*):\s*(.*)$/))
			.filter((found): found is RegExpMatchArray => found !== null)
			.map((found) => [found[1], found[2].trim().replace(/^(["'])(.*)\1$/, "$2")]),
	);
	return { fields, body: text.slice(match[0].length), bodyLine: match[0].split("\n").length };
}

const fileSlug = (path: string): string => (path.split("/").pop() ?? path).replace(/\.md$/, "");
const folderName = (path: string): string => path.split("/").slice(0, -1).join("/");

/** Reads one file into an item, or the problem that stops it. */
function readItem({ file, kind, fallbackSlug }: { file: DocsFolderFile; kind: DocsItemKind; fallbackSlug: string }): DocsFolderItem | DocsFolderProblem {
	const front = readFrontMatter(file.text);
	if (!front) return { source: file.path, message: "It doesn't start with front matter (a block between --- lines with title, description, slug and order).", line: 1 };
	const title = front.fields.title ?? "";
	if (!title) return { source: file.path, message: "Its front matter has no title.", line: 1 };
	const order = Number(front.fields.order ?? "0");
	const mdx = kind === "page" ? front.body.trim() : "";
	if (mdx) {
		const read = mdxToBlocks({ text: mdx, newId: () => "check" });
		if (!read.ok) return { source: file.path, message: read.message, line: read.line === null ? null : read.line + front.bodyLine - 1 };
	}
	return {
		title,
		description: front.fields.description ?? "",
		slug: front.fields.slug || fallbackSlug,
		kind,
		order: Number.isFinite(order) ? order : 0,
		mdx,
		source: file.path,
		children: [],
	};
}

const isProblem = (value: DocsFolderItem | DocsFolderProblem): value is DocsFolderProblem => "message" in value;

const byOrder = (a: DocsFolderItem, b: DocsFolderItem): number => a.order - b.order || a.title.localeCompare(b.title);

/** Two items under one parent with the same address would collide on the site. */
function findSameSlugs(items: DocsFolderItem[]): DocsFolderProblem[] {
	const seen = new Map<string, string>();
	return items.flatMap((item) => {
		const first = seen.get(item.slug);
		seen.set(item.slug, first ?? item.source);
		return first ? [{ source: item.source, message: `Its slug "${item.slug}" is also used by ${first}, under the same parent.`, line: 1 }] : [];
	});
}

/** The items inside one folder (`""` is the docs folder itself): its pages, and its folders as groups. */
function readFolder({ files, folder, problems }: { files: DocsFolderFile[]; folder: string; problems: DocsFolderProblem[] }): DocsFolderItem[] {
	const inside = (file: DocsFolderFile): boolean => folderName(file.path) === folder;
	const prefix = folder ? `${folder}/` : "";
	const pages = files
		.filter((file) => inside(file) && file.path.endsWith(".md") && fileSlug(file.path) !== "_group" && !(folder === "" && file.path === HOME_FILE))
		.map((file) => readItem({ file, kind: "page", fallbackSlug: fileSlug(file.path) }));
	const subfolders = [...new Set(files.filter((file) => file.path.startsWith(prefix) && file.path.slice(prefix.length).includes("/")).map((file) => `${prefix}${file.path.slice(prefix.length).split("/")[0]}`))];
	const groups = subfolders.map((path): DocsFolderItem | DocsFolderProblem => {
		const groupFile = files.find((file) => file.path === `${path}/${GROUP_FILE}`) ?? { path: `${path}/${GROUP_FILE}`, text: `---\ntitle: ${fileSlug(path)}\n---\n` };
		const group = readItem({ file: groupFile, kind: "group", fallbackSlug: fileSlug(path) });
		return isProblem(group) ? group : { ...group, children: readFolder({ files, folder: path, problems }) };
	});
	const read = [...pages, ...groups];
	problems.push(...read.filter(isProblem));
	const items = read.filter((item): item is DocsFolderItem => !isProblem(item)).sort(byOrder);
	problems.push(...findSameSlugs(items));
	return items;
}

const countItems = (items: DocsFolderItem[]): number => items.reduce((total, item) => total + 1 + countItems(item.children), 0);

/** The docs a folder describes, with every page's MDX already checked, or every problem found. */
export function planDocsFolder({ files }: { files: DocsFolderFile[] }): DocsFolderPlan {
	const markdown = files.filter((file) => file.path.endsWith(".md")).map((file) => ({ ...file, path: file.path.replace(/\\/g, "/").replace(/^\.\//, "") }));
	const homeFile = markdown.find((file) => file.path === HOME_FILE);
	if (!homeFile) return { ok: false, problems: [{ source: HOME_FILE, message: "The folder has no index.md, the docs home.", line: null }] };
	const home = readItem({ file: homeFile, kind: "page", fallbackSlug: "docs" });
	const problems: DocsFolderProblem[] = isProblem(home) ? [home] : [];
	const children = readFolder({ files: markdown, folder: "", problems });
	if (isProblem(home) || problems.length > 0) return { ok: false, problems };
	return { ok: true, home: { ...home, children }, count: 1 + countItems(children) };
}
