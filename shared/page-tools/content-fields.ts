import { BLOCK_EXTRA_CONTENT_FIELDS } from "../block-catalog/content-fields.js";
import { findBlockEntry } from "../block-catalog/entries.js";
import type { BlockConfig } from "../schema-types.js";
import { isRecord, readContentRecord } from "./is-record.js";

/** A block's content fields: each name with its default (undefined when it has none), and the names inside object fields. */
type FieldList = { top: Map<string, unknown>; inside: Map<string, Set<string>> };

/** Most unknown fields named in one refusal. */
const MAX_NAMED = 3;

/** `mergeContentFields` explains these two itself. */
const LEFT_TO_MERGE = new Set(["kind", "data"]);

/** Names models reach for that a block calls something else. Suggested only when the block has the target. */
const COMMON_ALIASES: Record<string, string> = { text: "value", src: "url", href: "url", link: "url", image: "url" };

/** CSS-looking names. A content field by such a name that the block lacks is almost always a style sent to the wrong place. */
const STYLE_NAME =
	/^(text[A-Z]|font[A-Z]|line[A-Z]|letter[A-Z]|padding|margin|border|background|flex|grid|justify|align[A-Z]|object[A-Z]|max[A-Z]|min[A-Z]|box[A-Z]|overflow)|^(color|gap|rowGap|columnGap|width|height|display|opacity|position|zIndex)$/;

/** The fields as stored: inside `data` for structured content, next to `kind` otherwise. */
const readContentFields = (content: BlockConfig["content"] | undefined): Record<string, unknown> => {
	const record = content === undefined ? null : readContentRecord(content);
	if (!record) return {};
	if (record.kind === "structured") return isRecord(record.data) ? record.data : {};
	const { kind: _kind, ...fields } = record;
	return fields;
};

const LISTS = new Map<string, FieldList>();

/** Every field a block uses: its default content plus the catalog's extras. Null for an unknown block. */
const fieldListOf = (name: string): FieldList | null => {
	const cached = LISTS.get(name);
	if (cached) return cached;
	const entry = findBlockEntry(name);
	if (!entry) return null;
	const defaults = readContentFields(entry.defaultContent());
	const top = new Map<string, unknown>(Object.entries(defaults));
	const inside = new Map<string, Set<string>>(
		Object.entries(defaults).flatMap(([key, value]) => (isRecord(value) ? [[key, new Set(Object.keys(value))] as const] : [])),
	);
	for (const extra of BLOCK_EXTRA_CONTENT_FIELDS[entry.name] ?? []) {
		const [key, sub] = extra.split(".");
		if (!top.has(key)) top.set(key, undefined);
		if (sub) inside.set(key, new Set([...(inside.get(key) ?? []), sub]));
	}
	const list = { top, inside };
	LISTS.set(name, list);
	return list;
};

/** A known name the agent probably meant: same letters in another case, one name inside the other, or a common alias. */
const closeName = ({ typed, known }: { typed: string; known: Iterable<string> }): string | null => {
	const names = [...known];
	const lower = typed.toLowerCase();
	const alias = COMMON_ALIASES[lower];
	return (
		names.find((name) => name.toLowerCase() === lower) ??
		(alias && names.includes(alias) ? alias : undefined) ??
		names.find((name) => lower.length >= 3 && (name.toLowerCase().includes(lower) || lower.includes(name.toLowerCase()))) ??
		null
	);
};

const hintForTop = ({ key, list }: { key: string; list: FieldList }): string => {
	const holder = [...list.inside].find(([, names]) => names.has(key))?.[0];
	if (holder) return ` Did you mean ${holder}.${key}? Send {"${holder}": {"${key}": …}}.`;
	const close = closeName({ typed: key, known: list.top.keys() });
	if (close) return ` Did you mean ${close}?`;
	if (STYLE_NAME.test(key)) return ` ${key} is a style: send it in styles, not content.`;
	return "";
};

const describeOne = (value: unknown): string => {
	if (typeof value === "string") return " (text)";
	if (typeof value === "number") return " (number)";
	if (typeof value === "boolean") return " (true/false)";
	if (Array.isArray(value)) return " (list)";
	return "";
};

/**
 * A block's content fields as one line for a model, e.g. `value (text), level (number), icon
 * (iconSet, iconName, …)`. Empty for an unknown block.
 */
export const describeContentFields = (name: string): string => {
	const list = fieldListOf(name);
	if (!list) return "";
	return [...list.top]
		.map(([key, value]) => {
			const inside = list.inside.get(key);
			return inside ? `${key} (${[...inside].join(", ")})` : `${key}${describeOne(value)}`;
		})
		.join(", ");
};

/**
 * Why some of these content fields don't belong on this block, or null when they all do. A field
 * the block already has is always fine (old pages carry fields the catalog no longer lists), and
 * a `null` (which removes a field) is always fine.
 *
 * WHY refuse: a field nothing reads is saved without complaint and does nothing. That is how an
 * icon name sent one level too high left every icon as the default star.
 */
export const explainUnknownContentFields = ({
	name,
	fields,
	existing,
}: {
	name: string;
	fields: Record<string, unknown> | undefined;
	/** The block's content now, when changing a block that already exists. */
	existing?: BlockConfig["content"];
}): string | null => {
	const list = fieldListOf(name);
	if (!list || !fields) return null;
	const current = readContentFields(existing);

	const problems = Object.entries(fields).flatMap(([key, value]): string[] => {
		if (value === null || LEFT_TO_MERGE.has(key)) return [];
		if (!list.top.has(key) && !(key in current)) return [`"${key}" isn't a field of ${name}.${hintForTop({ key, list })}`];
		const allowed = list.inside.get(key);
		if (!allowed || !isRecord(value)) return [];
		const currentInside = isRecord(current[key]) ? current[key] : {};
		return Object.entries(value)
			.filter(([sub, subValue]) => subValue !== null && !allowed.has(sub) && !(sub in currentInside))
			.map(([sub]) => {
				const close = closeName({ typed: sub, known: allowed });
				return `"${key}.${sub}" isn't a field of ${name}.${close ? ` Did you mean ${key}.${close}?` : ""}`;
			});
	});
	if (problems.length === 0) return null;
	const more = problems.length > MAX_NAMED ? ` (and ${problems.length - MAX_NAMED} more)` : "";
	return `${problems.slice(0, MAX_NAMED).join(" ")}${more} Its content fields: ${describeContentFields(name)}.`;
};
