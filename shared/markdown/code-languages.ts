import type { Language } from "@vortexlabs/kirari/core";
import { plaintext } from "@vortexlabs/kirari/languages";
import { createRegistry } from "@vortexlabs/kirari/registry";
import { KIRARI_LANGUAGES } from "./kirari-options.js";

/** A language people can pick for a code block, with the name shown on the block. */
export type CodeLanguageOption = { value: string; label: string };

/**
 * Kirari's own name matching (`ts`, `sh`, `yml`, file names like `app.py`): the very rule the
 * markdown plugin applies to fences, so a code block and a fence resolve a name the same way.
 */
const registry = createRegistry(KIRARI_LANGUAGES);

/** Names writers use that Kirari's matching doesn't know. */
const EXTRA_NAMES = new Map([
	["console", "shell"],
	["mdx", "markdown"],
]);

/** Labels for the block's language picker and the code header. Anything missing shows its own name. */
const LABELS: Record<string, string> = {
	c: "C",
	cpp: "C++",
	csharp: "C#",
	css: "CSS",
	dotenv: ".env",
	glsl: "GLSL",
	graphql: "GraphQL",
	hcl: "HCL (Terraform)",
	html: "HTML",
	ini: "INI",
	javascript: "JavaScript",
	json: "JSON",
	jsonc: "JSON with comments",
	jsx: "JSX",
	php: "PHP",
	plaintext: "Plain text",
	powershell: "PowerShell",
	r: "R",
	shell: "Shell",
	sql: "SQL",
	toml: "TOML",
	tsx: "TSX",
	typescript: "TypeScript",
	xml: "XML",
	yaml: "YAML",
};

const capitalize = (name: string): string => `${name.charAt(0).toUpperCase()}${name.slice(1)}`;

/** The language's own name for what was typed (`ts` → `typescript`), or null when it isn't one we highlight. */
export const resolveCodeLanguage = (typed: string | null | undefined): string | null => {
	const name = (typed ?? "").trim().toLowerCase();
	if (!name) return null;
	return registry.resolve(EXTRA_NAMES.get(name) ?? name)?.name ?? null;
};

/** The definition Kirari needs. Unknown names get plain text, so code always shows. */
export const getCodeLanguage = (name: string | null): Language => registry.resolve(name ?? "plaintext") ?? plaintext;

/** The label shown for a language name. */
export const codeLanguageLabel = (name: string): string => LABELS[name] ?? capitalize(name);

/** Every language, sorted by label, for pickers. */
export const CODE_LANGUAGE_OPTIONS: readonly CodeLanguageOption[] = KIRARI_LANGUAGES.map(({ name }) => ({
	value: name,
	label: codeLanguageLabel(name),
})).sort((a, b) => a.label.localeCompare(b.label));
