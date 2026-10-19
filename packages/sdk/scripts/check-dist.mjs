// Fails the build when the published files point at things a user's machine does not have.
//
// WHY: the SDK packs a few files from the repo's `shared/` folder into its build. Those files are
// typed with the app's own types, which reach React. If one slips past `src/blocks/shared-catalog.ts`,
// the published `index.d.ts` would import `react` (or a path into `shared/`) and every user's
// TypeScript would break, and a leftover relative import in `index.js` would break at run time.
//
// Plain Node on purpose: it runs right after `tsup`, with nothing to install.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

const FILES = ["index.js", "index.d.ts"];

// `from "x"`, `import "x"`, `import("x")`, `require("x")` and `/// <reference types="x" />`.
const SPECIFIER_PATTERNS = [
	/\bfrom\s*["']([^"']+)["']/g,
	/\bimport\s*["']([^"']+)["']/g,
	/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
	/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
	/^\s*\/\/\/\s*<reference\s+(?:types|path)\s*=\s*["']([^"']+)["']/gm,
];

/** Why a specifier must not appear in a published file, or null when it is fine. */
const explainProblem = (specifier) => {
	if (specifier === "react" || specifier.startsWith("react/") || specifier.startsWith("react-dom")) {
		return "it imports React, which the SDK must not depend on";
	}
	if (specifier.includes("shared/") || specifier.startsWith("@shared")) {
		return "it points into the repo's shared/ folder, which is not published";
	}
	if (specifier.startsWith(".") || specifier.startsWith("/")) {
		return "it is a file path; everything must be bundled into this single file";
	}
	return null;
};

const readDist = (file) => {
	try {
		return readFileSync(join(distDir, file), "utf8");
	} catch (error) {
		console.error(`check-dist: cannot read dist/${file}. Run the build first.\n  ${error.message}`);
		process.exit(1);
	}
};

const problems = FILES.flatMap((file) => {
	const source = readDist(file);
	return SPECIFIER_PATTERNS.flatMap((pattern) =>
		[...source.matchAll(pattern)].flatMap((match) => {
			const reason = explainProblem(match[1]);
			return reason ? [`  dist/${file}: "${match[1]}" — ${reason}`] : [];
		}),
	);
});

if (problems.length > 0) {
	console.error(
		[
			"check-dist: the build output is not safe to publish.",
			...problems,
			"",
			"Fix: re-export shared code only through src/blocks/shared-catalog.ts, typed with the SDK's own types (src/types/domain.ts).",
		].join("\n"),
	);
	process.exit(1);
}

console.log(`check-dist: ok (${FILES.join(", ")} import nothing from react or shared/)`);
