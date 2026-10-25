import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("the search library file", () => {
	it("is the package's browser build, ready to be served as /vendor/minisearch.js", () => {
		const file = path.join(process.cwd(), "node_modules/minisearch/dist/umd/index.js");
		expect(existsSync(file)).toBe(true);
		expect(readFileSync(file, "utf8")).toContain("global.MiniSearch = factory()");
	});

	it("is listed among the vendor files with the package as a fallback place to find it", () => {
		const routes = readFileSync(path.join(process.cwd(), "server/routes/index.ts"), "utf8");
		expect(routes).toContain("'minisearch.js': vendorCandidates('minisearch.js', path.join(process.cwd(), 'node_modules/minisearch/dist/umd/index.js'))");
	});
});
