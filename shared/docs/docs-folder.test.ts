import { describe, expect, it } from "vitest";
import { planDocsFolder, type DocsFolderFile } from "./docs-folder.js";

const page = ({ title, slug, order, body = "Text.", description = "" }: { title: string; slug?: string; order?: number; body?: string; description?: string }): string =>
	["---", `title: ${title}`, description ? `description: "${description}"` : "", slug ? `slug: ${slug}` : "", order === undefined ? "" : `order: ${order}`, "---", "", body, ""].filter((line, index) => line !== "" || index > 5).join("\n");

const folder = (): DocsFolderFile[] => [
	{ path: "index.md", text: page({ title: "Acme Docs", slug: "docs", description: "All about Acme", body: "# Welcome\n\n<Note>Start here.</Note>" }) },
	{ path: "people.md", text: page({ title: "People", order: 9 }) },
	{ path: "guides/_group.md", text: "---\ntitle: Guides\norder: 2\n---\n" },
	{ path: "guides/deploy.md", text: page({ title: "Deploy", order: 2 }) },
	{ path: "guides/install.md", text: page({ title: "Install", slug: "setup", order: 1 }) },
	{ path: "start/first.md", text: page({ title: "First steps", order: 1 }) },
	{ path: "start/_group.md", text: "---\ntitle: Getting started\norder: 1\n---\n" },
	{ path: "logo.png", text: "" },
];

describe("reading a docs folder", () => {
	it("makes index.md the home and folders groups, everything in its order", () => {
		const plan = planDocsFolder({ files: folder() });
		if (!plan.ok) throw new Error(JSON.stringify(plan.problems));

		expect(plan.home).toMatchObject({ title: "Acme Docs", slug: "docs", description: "All about Acme", kind: "page" });
		expect(plan.home.mdx).toContain("<Note>Start here.</Note>");
		expect(plan.home.children.map((item) => [item.title, item.kind])).toEqual([
			["Getting started", "group"],
			["Guides", "group"],
			["People", "page"],
		]);
		expect(plan.home.children[1].children.map((item) => [item.title, item.slug])).toEqual([
			["Install", "setup"],
			["Deploy", "deploy"],
		]);
		expect(plan.count).toBe(7);
	});

	it("names a folder without _group.md after the folder", () => {
		const plan = planDocsFolder({ files: [...folder().filter((file) => file.path !== "start/_group.md")] });
		expect(plan.ok && plan.home.children.map((item) => item.title)).toContain("start");
	});

	it("reports every problem, with the file and line, before anything is made", () => {
		const plan = planDocsFolder({
			files: [
				...folder(),
				{ path: "broken.md", text: page({ title: "Broken", body: "Fine line.\n\n<Note>Never closed" }) },
				{ path: "untitled.md", text: "---\nslug: nameless\n---\nText" },
				{ path: "plain.md", text: "No front matter here." },
				{ path: "guides/again.md", text: page({ title: "Again", slug: "deploy" }) },
			],
		});

		expect(plan.ok).toBe(false);
		if (plan.ok) return;
		const bySource = Object.fromEntries(plan.problems.map((problem) => [problem.source, problem]));
		expect(bySource["broken.md"].line).toBeGreaterThan(4);
		expect(bySource["untitled.md"].message).toBe("Its front matter has no title.");
		expect(bySource["plain.md"].message).toMatch(/front matter/);
		const clash = plan.problems.find((problem) => problem.message.includes('slug "deploy"'));
		expect([clash?.source, clash?.message]).toEqual(["guides/deploy.md", 'Its slug "deploy" is also used by guides/again.md, under the same parent.']);
	});

	it("needs an index.md", () => {
		expect(planDocsFolder({ files: folder().filter((file) => file.path !== "index.md") })).toEqual({
			ok: false,
			problems: [{ source: "index.md", message: "The folder has no index.md, the docs home.", line: null }],
		});
	});
});
