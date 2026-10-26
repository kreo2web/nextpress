/**
 * Makes a docs in NextPress from a folder of Markdown files (the format `shared/docs/docs-folder.ts`
 * describes), through the SDK, the way any client would. Every page is checked before anything is
 * made, so a mistake never leaves half a docs behind.
 *
 *   cd packages/sdk && npx tsx scripts/import-docs-folder.ts \
 *     --folder ../../content/nextpress-docs \
 *     --base-url http://localhost:5055 --site <site id> --key-file <file holding an API key> \
 *     [--export ../../nextpress-docs.page.json] [--dry-run]
 *
 * `--dry-run` only reads and checks the folder. `--export` then saves the new docs as one page file,
 * which Docs → Import (or the page file import) takes on another install. The key is read from a
 * file so it never sits in the shell history. It makes new docs only: when the site already has docs
 * at the home's address it stops, and nothing is changed.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { planDocsFolder, type DocsFolderItem } from "../../../shared/docs/docs-folder.js";
import { retryFnWithJitter } from "../../../shared/retry-fn-with-jitter.js";
import { createNextpress } from "../src/index.js";

type Options = { folder: string; baseUrl: string; siteId: string; keyFile: string; exportTo: string; dryRun: boolean };

const USAGE = "Usage: import-docs-folder.ts --folder <dir> --base-url <url> --site <site id> --key-file <file> [--export <file>] [--dry-run]";

function readOptions(argv: string[]): Options {
	const value = (flag: string): string => {
		const at = argv.indexOf(flag);
		return at >= 0 ? (argv[at + 1] ?? "") : "";
	};
	const options = {
		folder: value("--folder"),
		baseUrl: value("--base-url").replace(/\/+$/, ""),
		siteId: value("--site"),
		keyFile: value("--key-file"),
		exportTo: value("--export"),
		dryRun: argv.includes("--dry-run"),
	};
	if (!options.folder) throw new Error(`Name the docs folder with --folder.\n${USAGE}`);
	if (!options.dryRun && (!options.baseUrl || !options.siteId || !options.keyFile)) throw new Error(`To import, give --base-url, --site and --key-file.\n${USAGE}`);
	return options;
}

const listFiles = (dir: string): string[] => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? listFiles(join(dir, name)) : [join(dir, name)]));

const printTree = (items: DocsFolderItem[], depth = 1): void =>
	items.forEach((item) => {
		console.log(`${"  ".repeat(depth)}${item.kind === "group" ? "+" : "-"} ${item.title} (/${item.slug})`);
		printTree(item.children, depth + 1);
	});

/** A failed SDK call as an Error that says whether trying again could help (the server asked to slow down). */
const callError = ({ status, message, what }: { status?: number; message: string; what: string }): Error & { status?: number } =>
	Object.assign(new Error(`${what}: ${message}`), { status });

/** Retries only "too many changes at once" (429), with jitter, for up to two minutes. */
const withRetry = <T>(fn: () => Promise<T>): Promise<T> =>
	retryFnWithJitter({ fn, baseDelayMs: 2_000, maxDelayMs: 20_000, maxDurationMs: 120_000, shouldRetry: (error) => (error as Error & { status?: number }).status === 429 });

async function importDocs({ options, home, count }: { options: Options; home: DocsFolderItem; count: number }): Promise<void> {
	const apiKey = readFileSync(resolve(options.keyFile), "utf8").trim();
	const nextpress = createNextpress({ baseUrl: options.baseUrl, apiKey, siteId: options.siteId });

	const existing = await nextpress.docs.list();
	const taken = existing.docs.find((entry) => entry.path === `/${home.slug}`);
	if (taken) throw new Error(`"${taken.name}" already lives at /${home.slug} on this site. This makes new docs only: rename or remove those first, or give index.md another slug.`);

	const created = await withRetry(async () => {
		const result = await nextpress.docs.create({ name: home.title, slug: home.slug });
		if (result.isErr) throw callError({ ...result.error, what: "Making the docs" });
		return result.value;
	});
	const homeId = created.homeId;
	console.log(`Made "${home.title}" at ${created.docs.path}.`);

	const writePage = async ({ pageId, item }: { pageId: string; item: DocsFolderItem }): Promise<void> => {
		await withRetry(async () => {
			const current = await nextpress.docs.readPage({ pageId });
			const result = await nextpress.docs.writePage({ pageId, mdx: item.mdx, expectedVersion: current.version, title: item.title, description: item.description });
			if (result.isErr) throw callError({ ...result.error, what: `Writing ${item.source}` });
		});
	};

	await writePage({ pageId: homeId, item: home });
	let done = 1;

	const addAll = async ({ items, parentId }: { items: DocsFolderItem[]; parentId: string }): Promise<void> => {
		for (const item of items) {
			const added = await withRetry(async () => {
				const result = await nextpress.docs.addItem({ homeId, parentId, title: item.title, kind: item.kind, slug: item.slug });
				if (result.isErr) throw callError({ ...result.error, what: `Adding ${item.source}` });
				return result.value.item;
			});
			if (item.kind === "page") await writePage({ pageId: added.id, item });
			done += 1;
			const moved = added.slug !== item.slug ? ` (as /${added.slug}: /${item.slug} was taken on this site)` : "";
			console.log(`  ${done}/${count} ${item.title}${moved}`);
			await addAll({ items: item.children, parentId: added.id });
		}
	};
	await addAll({ items: home.children, parentId: homeId });

	if (options.exportTo) {
		const file = await nextpress.docs.exportFile({ homeId });
		writeFileSync(resolve(options.exportTo), file.bytes);
		console.log(`Saved the page file to ${options.exportTo} (the server calls it ${file.fileName}).`);
	}
	console.log(`Done. Open it in the editor: ${options.baseUrl}/admin/page-builder/page/${homeId}`);
}

async function main(): Promise<void> {
	const options = readOptions(process.argv.slice(2));
	const root = resolve(options.folder);
	const files = listFiles(root).map((path) => ({ path: relative(root, path).split("\\").join("/"), text: readFileSync(path, "utf8") }));
	const plan = planDocsFolder({ files });
	if (!plan.ok) {
		console.error("The folder has problems; nothing was made:");
		plan.problems.forEach((problem) => console.error(`  ${problem.source}${problem.line === null ? "" : `:${problem.line}`}  ${problem.message}`));
		process.exitCode = 1;
		return;
	}
	console.log(`${plan.home.title} (/${plan.home.slug}): ${plan.count} pages and groups, all checked.`);
	printTree(plan.home.children);
	if (options.dryRun) return;
	await importDocs({ options, home: plan.home, count: plan.count });
}

main().catch((error: Error) => {
	console.error(error.message);
	process.exitCode = 1;
});
