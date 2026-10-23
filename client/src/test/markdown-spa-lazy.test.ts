import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const markdownBlockPath = resolve(
	here,
	"../../../renderer/react/advanced/MarkdownBlock.tsx",
);

describe("SPA MarkdownBlock", () => {
	it("imports the shared markdown view directly (not lazily) for reliable preview rendering", () => {
		const source = readFileSync(markdownBlockPath, "utf8");
		expect(source).toContain('import { MarkdownView } from "@shared/markdown"');
		expect(source).not.toContain("React.lazy");
		// Pele's full bundle is server-only (MarkdownSsrBlock); the SPA loads diagrams on demand.
		expect(source).not.toContain('from "pele"');
	});
});
