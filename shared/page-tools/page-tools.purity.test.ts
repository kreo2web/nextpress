import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

/** The only package the page tools may load. Everything else must be reached by a relative path. */
const ALLOWED_PACKAGES = new Set(["zod"]);

const importPattern = /^\s*(import|export)\s+(type\s+)?[^;]*?from\s+["']([^"']+)["']/gm;
const dynamicImportPattern = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const requirePattern = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;

describe("shared/page-tools", () => {
	/**
	 * The page tools run in the browser (the editor), on the server (the assistant) and inside
	 * the SDK's build. So everything they load, through every file they reach, must be plain
	 * TypeScript found by relative path, plus `zod`: no React, no DOM, no `@shared/` alias and
	 * no `node:` modules. Type-only imports are erased and allowed.
	 */
	it("loads only relative code and zod, with no React, DOM or node: modules (checked through every file it reaches)", () => {
		const seen = new Set<string>();
		const problems: string[] = [];

		const visit = (file: string): void => {
			if (seen.has(file)) return;
			seen.add(file);
			if (file.endsWith(".tsx")) problems.push(`${file} is a .tsx file`);
			const source = readFileSync(file, "utf8");

			const dynamic = [...source.matchAll(dynamicImportPattern), ...source.matchAll(requirePattern)];
			for (const match of dynamic) problems.push(`${file} loads "${match[1]}" at run time`);

			for (const match of source.matchAll(importPattern)) {
				const isTypeOnly = Boolean(match[2]);
				const spec = match[3];
				if (isTypeOnly) continue;
				if (!spec.startsWith(".")) {
					if (!ALLOWED_PACKAGES.has(spec)) problems.push(`${file} imports "${spec}"`);
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

			for (const global of ["document.", "window.", "localStorage", "navigator."]) {
				if (new RegExp(`(^|[^\\w.])${global.replace(".", "\\.")}`, "m").test(source.replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, ""))) {
					problems.push(`${file} uses the browser global "${global}"`);
				}
			}
		};

		const files = readdirSync(here).filter(
			(name) => name.endsWith(".ts") && !name.endsWith(".test.ts"),
		);
		expect(files.length).toBeGreaterThan(10);
		for (const name of files) visit(join(here, name));
		expect(problems).toEqual([]);
		// The walk really went past this folder (catalog, save rules, phone check).
		expect([...seen].some((file) => file.endsWith("validate-content-save.ts"))).toBe(true);
		expect([...seen].some((file) => file.endsWith("validate-block-responsive-health.ts"))).toBe(true);
		expect([...seen].some((file) => file.includes("block-catalog"))).toBe(true);
	});
});
