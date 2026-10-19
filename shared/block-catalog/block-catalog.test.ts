import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateContentForSave } from "../validate-content-save";
import { BLOCK_NAMES, createDefaultBlock, findBlockEntry } from "./index";
import { RAW_BLOCK_ENTRIES } from "./entries";

const here = dirname(fileURLToPath(import.meta.url));

describe("block catalog", () => {
	it("has exactly one entry for every block name, and nothing else", () => {
		const written = RAW_BLOCK_ENTRIES.map((entry) => entry.name).sort();
		expect(written).toEqual([...BLOCK_NAMES].sort());
	});

	it("hands out a fresh default every time", () => {
		for (const name of BLOCK_NAMES) {
			const entry = findBlockEntry(name);
			const first = entry?.defaultContent();
			expect(first).toEqual(entry?.defaultContent());
			if (first && typeof first === "object") {
				expect(first).not.toBe(entry?.defaultContent());
			}
		}
	});

	it("gives starting children only to containers", () => {
		for (const entry of RAW_BLOCK_ENTRIES) {
			if (entry.kind !== "container") expect(entry.defaultChildren).toBeUndefined();
		}
	});

	it.each([...BLOCK_NAMES])("makes a %s block the server accepts", (name) => {
		let n = 0;
		const block = createDefaultBlock({ name, id: `block-${name}`, newId: () => `child-${++n}` });
		expect(block).not.toBeNull();
		const result = validateContentForSave({ blocks: [block], contentType: "page" });
		expect(result.ok ? "ok" : result.error.message).toBe("ok");
	});

	it("gives every block a note for agents", () => {
		for (const name of BLOCK_NAMES) {
			expect(findBlockEntry(name)?.agentNote.trim().length, name).toBeGreaterThan(20);
		}
	});

	it("returns null for a name NextPress does not know", () => {
		expect(createDefaultBlock({ name: "core/nope", id: "x", newId: () => "y" })).toBeNull();
	});

	/**
	 * The SDK packs this folder into its build, so everything it loads must be
	 * plain TypeScript reached by relative paths: no React, no DOM, no `@shared/` alias.
	 * Type-only imports are erased and allowed.
	 */
	it("loads only relative, non-React code (checked through every file it reaches)", () => {
		const seen = new Set<string>();
		const problems: string[] = [];
		const importPattern = /^\s*(import|export)\s+(type\s+)?[^;]*?from\s+["']([^"']+)["']/gm;

		const visit = (file: string) => {
			if (seen.has(file)) return;
			seen.add(file);
			if (file.endsWith(".tsx")) problems.push(`${file} is a .tsx file`);
			const source = readFileSync(file, "utf8");
			for (const match of source.matchAll(importPattern)) {
				const isTypeOnly = Boolean(match[2]);
				const spec = match[3];
				if (isTypeOnly) continue;
				if (!spec.startsWith(".")) {
					problems.push(`${file} imports "${spec}"`);
					continue;
				}
				const base = resolve(dirname(file), spec.replace(/\.js$/, ""));
				const candidates = [`${base}.ts`, join(base, "index.ts"), `${base}.tsx`];
				const target = candidates.find((path) => {
					try {
						readFileSync(path);
						return true;
					} catch (error) {
						if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
						throw error;
					}
				});
				if (!target) problems.push(`${file} imports "${spec}", which was not found`);
				else visit(target);
			}
		};

		for (const name of readdirSync(here)) {
			if (name.endsWith(".ts") && !name.endsWith(".test.ts")) visit(join(here, name));
		}
		expect(problems).toEqual([]);
	});
});
