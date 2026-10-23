import { z } from "zod";
import { changeBlocksShape } from "./block-spec-schema.js";
import { isRecord } from "./is-record.js";
import { attempt } from "./tool-helpers.js";

const changeBlocksSchema = z.object(changeBlocksShape);

const CLOSER_OF: Record<string, string> = { "{": "}", "[": "]" };

/**
 * JSON text with its brackets put right: a closing bracket that doesn't close the bracket open
 * at that point is dropped, and closers still missing at the end are added. Text inside strings
 * is left alone.
 *
 * WHY: models that send `ops` as one long string write that JSON by hand, and the mistake seen
 * every time is one `}` too many after a nested object, which made the whole change unreadable.
 */
export const balanceBrackets = (text: string): string => {
	const open: string[] = [];
	let out = "";
	let inString = false;
	let escaped = false;
	for (const char of text) {
		if (inString) {
			out += char;
			if (escaped) escaped = false;
			else if (char === "\\") escaped = true;
			else if (char === '"') inString = false;
		} else if (char === '"') {
			inString = true;
			out += char;
		} else if (CLOSER_OF[char]) {
			open.push(CLOSER_OF[char]);
			out += char;
		} else if (char === "}" || char === "]") {
			if (open.at(-1) !== char) continue;
			open.pop();
			out += char;
		} else {
			out += char;
		}
	}
	return out + open.reverse().join("");
};

const parseJson = async (text: string): Promise<unknown> => {
	const parsed = await attempt(async (): Promise<unknown> => JSON.parse(text));
	return parsed.ok ? parsed.value : undefined;
};

/** Parsed JSON, trying once more with its brackets put right. Undefined when it still isn't JSON: that just means "can't repair". */
const readJson = async (text: string): Promise<unknown> => (await parseJson(text)) ?? parseJson(balanceBrackets(text));

/** The keys a block may have. Anything else a model puts on a block is a content field sent one level too high. */
const BLOCK_KEYS = new Set(["name", "ref", "label", "content", "styles", "fillBehind", "children"]);

/**
 * A block with stray fields (seen: a button's `url` next to `content`) moved into its content, at
 * every level. What the block's own content already says wins. The content-field check then
 * names any field the block really doesn't have.
 */
const tidyBlock = async (value: unknown): Promise<unknown> => {
	const block = typeof value === "string" ? await readJson(value) : value;
	if (!isRecord(block)) return value;
	const kept = Object.entries(block).filter(([key]) => BLOCK_KEYS.has(key));
	const stray = Object.entries(block).filter(([key]) => !BLOCK_KEYS.has(key));
	const tidied: Record<string, unknown> = Object.fromEntries(kept);
	if (stray.length > 0) tidied.content = { ...Object.fromEntries(stray), ...(isRecord(block.content) ? block.content : {}) };
	if (Array.isArray(block.children)) tidied.children = await Promise.all(block.children.map(tidyBlock));
	return tidied;
};

/**
 * Some models put a block's fields on the op instead of inside `block` (seen: `styles`, `label`).
 * Move them where the schema expects them, keeping whatever the block already says. `label` may
 * stay on the op too; the others may not.
 */
const tidyInsertOrReplace = async (op: Record<string, unknown>): Promise<Record<string, unknown>> => {
	const block = typeof op.block === "string" ? await readJson(op.block) : op.block;
	if (!isRecord(block)) return op;
	const withOpFields: Record<string, unknown> = { ...block };
	for (const field of ["content", "styles", "label", "ref", "fillBehind"] as const) {
		if (op[field] !== undefined && withOpFields[field] === undefined) withOpFields[field] = op[field];
	}
	const { content: _content, styles: _styles, ref: _ref, fillBehind: _fillBehind, ...rest } = op;
	return { ...rest, block: await tidyBlock(withOpFields) };
};

/**
 * Repairs the shape mistakes smaller models make in `change_blocks` input before the tool runs:
 * `ops` sent as a JSON string (even with a bracket too many or missing), a `block` sent as a JSON
 * string, block fields left on the op, and content fields left on the block.
 * Returns the fixed JSON, or null when the input can't be made valid (the model is then told why
 * and tries again).
 */
export const repairChangeBlocksInput = async (input: string): Promise<string | null> => {
	const raw = await readJson(input);
	if (!isRecord(raw)) return null;
	const opsValue = typeof raw.ops === "string" ? await readJson(raw.ops) : raw.ops;
	if (!Array.isArray(opsValue)) return null;
	const ops = await Promise.all(
		opsValue.map((op) => (isRecord(op) && (op.op === "insert" || op.op === "replace") ? tidyInsertOrReplace(op) : op)),
	);
	const candidate = { ...raw, ops };
	return changeBlocksSchema.safeParse(candidate).success ? JSON.stringify(candidate) : null;
};
