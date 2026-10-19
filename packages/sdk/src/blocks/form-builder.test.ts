import { describe, expect, it } from "vitest";
import { checkPage } from "../agent/index.js";
import { createBlocksBuilder } from "./build-block.js";
import { validateBlockTree } from "./validate-block-tree.js";

describe("blocks.form", () => {
	const blocks = createBlocksBuilder();

	it("starts like a form added in the editor: a name, an email, a message and a Send button", () => {
		const form = blocks.form();
		expect(form.name).toBe("core/form");
		expect(form.type).toBe("container");
		expect(form.content).toMatchObject({
			kind: "structured",
			data: { name: "Contact", successMessage: expect.stringContaining("Thanks") },
		});
		expect(form.children?.map((child) => child.name)).toEqual([
			"core/input",
			"core/input",
			"core/textarea",
			"core/button",
		]);
		expect(form.children?.every((child) => child.parentId === form.id)).toBe(true);
		expect(form.children?.at(-1)?.content).toMatchObject({ kind: "text", value: "Send", action: "submit" });
		expect(checkPage({ blocks: [form] })).toEqual({ ok: true, problems: [] });
	});

	it("takes the form's name and success message", () => {
		const form = blocks.form({ settings: { content: { name: "Waitlist", successMessage: "You are on the list." } } });
		expect(form.content).toMatchObject({ data: { name: "Waitlist", successMessage: "You are on the list." } });
	});

	it("uses the fields it is given instead of the starting ones", () => {
		const form = blocks.form({
			settings: { content: { name: "Waitlist" } },
			children: [
				blocks.input({ settings: { content: { name: "email", label: "Your email", type: "email", required: true } } }),
				blocks.select({
					settings: {
						content: { name: "plan", label: "Plan", options: [{ label: "Free", value: "free" }] },
					},
				}),
				blocks.submitButton({ text: "Join" }),
			],
		});
		expect(form.children?.map((child) => child.name)).toEqual(["core/input", "core/select", "core/button"]);
		expect(form.children?.[0].content).toMatchObject({
			kind: "structured",
			data: { name: "email", label: "Your email", type: "email", required: true },
		});
		expect(form.children?.every((child) => child.parentId === form.id)).toBe(true);
		expect(validateBlockTree([form])).toMatchObject({ ok: true, blockCount: 4 });
		expect(checkPage({ blocks: [form] }).ok).toBe(true);
	});

	it("keeps an empty list of children empty", () => {
		expect(blocks.form({ children: [] }).children).toEqual([]);
	});
});

describe("blocks.submitButton", () => {
	const blocks = createBlocksBuilder();

	it("makes a button that sends the form", () => {
		const button = blocks.submitButton();
		expect(button.name).toBe("core/button");
		expect(button.content).toMatchObject({ kind: "text", value: "Send", action: "submit", url: "" });
		expect(blocks.submitButton({ text: "Join the list" }).content).toMatchObject({ value: "Join the list", action: "submit" });
	});

	it("is not what the plain button builder makes", () => {
		expect(blocks.button({ text: "Go" }).content).not.toHaveProperty("action");
	});
});
