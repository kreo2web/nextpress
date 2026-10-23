import type { Language } from "@vortexlabs/kirari/core";
import * as kirariLanguages from "@vortexlabs/kirari/languages";

/** A language people can pick for a code block, with the name shown on the block. */
export type CodeLanguageOption = { value: string; label: string };

/** Every language Kirari highlights, by its own name. */
const LANGUAGES: Record<string, Language> = { ...kirariLanguages };

/** Names people and fences commonly use for a language Kirari knows by another name. */
const ALIASES: Record<string, string> = {
	js: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	ts: "typescript",
	mts: "typescript",
	cts: "typescript",
	py: "python",
	rb: "ruby",
	rs: "rust",
	cs: "csharp",
	"c#": "csharp",
	"c++": "cpp",
	kt: "kotlin",
	bash: "shell",
	sh: "shell",
	zsh: "shell",
	console: "shell",
	ps1: "powershell",
	yml: "yaml",
	md: "markdown",
	mdx: "markdown",
	htm: "html",
	svg: "xml",
	env: "dotenv",
	tf: "hcl",
	proto: "protobuf",
	gql: "graphql",
	text: "plaintext",
	txt: "plaintext",
	plain: "plaintext",
};

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
	const resolved = ALIASES[name] ?? name;
	return resolved in LANGUAGES ? resolved : null;
};

/** The definition Kirari needs. Unknown names get plain text, so code always shows. */
export const getCodeLanguage = (name: string | null): Language => LANGUAGES[name ?? "plaintext"] ?? LANGUAGES.plaintext;

/** The label shown for a language name. */
export const codeLanguageLabel = (name: string): string => LABELS[name] ?? capitalize(name);

/** Every language, sorted by label, for pickers. */
export const CODE_LANGUAGE_OPTIONS: readonly CodeLanguageOption[] = Object.keys(LANGUAGES)
	.map((value) => ({ value, label: codeLanguageLabel(value) }))
	.sort((a, b) => a.label.localeCompare(b.label));
