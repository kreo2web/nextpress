import { z } from "zod";
import { type BlockName, resolveBlockName } from "../block-catalog/block-names.js";

/** Most changes one `change_blocks` call may hold. */
export const MAX_OPS_PER_CALL = 50;
/** Most blocks one `change_blocks` call may create, starting children included. */
export const MAX_NEW_BLOCKS_PER_CALL = 300;

/** What a ref may look like: a short name, never mistaken for a real (UUID) block id. */
export const REF_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;

/**
 * Every schema piece here is a factory: each use builds its own instance. When the same zod
 * instance shows up twice in one composed schema, the MCP library's JSON output points at it
 * with `$ref`s, and some agents' JSON-schema readers are strict about those. Fresh instances
 * keep every tool's schema self-contained.
 *
 * Only an insert's outer block carries descriptions; nested levels, a replace's block and an
 * update point back at it. The same words repeated at every level made the schema twice the
 * size, every model reads it on every step, and smaller models started sending it back malformed.
 */

/** Adds a description only where the schema is described. */
const say = <T extends z.ZodTypeAny>({ schema, text, described }: { schema: T; text: string; described: boolean }): T =>
	described ? schema.describe(text) : schema;

const makeBlockNameSchema = () =>
	z.string().transform((typed, ctx): BlockName => {
		const resolved = resolveBlockName(typed);
		if (resolved.ok) return resolved.name;
		ctx.addIssue({ code: z.ZodIssueCode.custom, message: resolved.message });
		return z.NEVER;
	});

const makeRefSchema = () =>
	z.string().regex(REF_PATTERN, 'A ref is a short name: a letter, then letters, digits, "-" or "_" (at most 40), such as "hero".');

const makeContentSchema = () => z.record(z.string(), z.unknown());

const makeStylesSchema = () => z.record(z.string(), z.union([z.string(), z.number(), z.null()]));

const CONTENT_TEXT =
	'Content fields to set, e.g. {"value": "Hello", "level": 1}, with no "kind" or "data" wrapper. get_block_type lists each block\'s fields. null removes a field.';
const STYLES_TEXT = 'CSS in camelCase, e.g. {"gap": "1rem"}. null removes a property.';
const FILL_BEHIND_TEXT =
	"Only for a layer directly inside an overlay Stack: true makes it fill the space the other layers make without growing it (a background picture or video).";
const AS_IN_INSERT = "As in an insert's block.";
const BLOCK_KEYS_TEXT =
	"A block has only name, ref, label, content, styles, fillBehind and children. Fields such as value, url or level go inside content.";
const DEEPEST_KEYS_TEXT =
	"No children this deep (four levels at most): give the block a ref and insert into it in a later op. Fields such as value, url or level go inside content.";

const makeSpecFields = (described: boolean) => ({
	name: say({
		schema: makeBlockNameSchema(),
		text: "Block name, such as heading or stack (core/ may be left out; post/ blocks need it).",
		described,
	}),
	ref: say({
		schema: makeRefSchema().optional(),
		text: 'Your short name for this new block, such as "hero", usable as an id or parentId by later ops in this call.',
		described,
	}),
	label: say({ schema: z.string().max(80).optional(), text: "Name shown in the editor's layers list.", described }),
	content: say({ schema: makeContentSchema().optional(), text: CONTENT_TEXT, described }),
	styles: say({ schema: makeStylesSchema().optional(), text: STYLES_TEXT, described }),
	fillBehind: say({ schema: z.boolean().optional(), text: FILL_BEHIND_TEXT, described }),
});

/**
 * A new block, up to four levels deep. Written out level by level instead of with a
 * recursive schema, because some AI providers reject recursive JSON schemas.
 */
const makeBlockSpecSchema = ({ described = true }: { described?: boolean } = {}) => {
	const spec4 = z.object(makeSpecFields(false)).strict(DEEPEST_KEYS_TEXT);
	const spec3 = z.object({ ...makeSpecFields(false), children: z.array(spec4).optional() }).strict(BLOCK_KEYS_TEXT);
	const spec2 = z.object({ ...makeSpecFields(false), children: z.array(spec3).optional() }).strict(BLOCK_KEYS_TEXT);
	return z
		.object({
			...makeSpecFields(described),
			children: say({
				schema: z.array(spec2).optional(),
				text: "Blocks inside this one (containers only), same fields, up to three more levels. They replace the starting children. Deeper: give a block a ref and insert into it in a later op.",
				described,
			}),
		})
		.strict(BLOCK_KEYS_TEXT);
};

const makeParentIdSchema = () =>
	z
		.string()
		.nullable()
		.describe(
			"Id of the container to put the block in (from get_page_outline, or a ref made earlier in this call), or null for the page root. At the root, blocks go inside the page shell.",
		);
const makeIndexSchema = () =>
	z.number().int().min(0).optional().describe("Position among the siblings, starting at 0. Leave out to add at the end.");
const makeIdSchema = () =>
	z.string().min(1).describe("Id of an existing block, from get_page_outline, or a ref made earlier in this call.");

const makeOpLabel = () =>
	z
		.string()
		.max(80)
		.optional()
		.describe("Same as block.label; taken here too because some models put it on the op.");

const makeInsertOp = () =>
	z
		.object({
			op: z.literal("insert"),
			parentId: makeParentIdSchema(),
			index: makeIndexSchema(),
			label: makeOpLabel(),
			block: makeBlockSpecSchema(),
		})
		.strict();
const makeUpdateOp = () =>
	z
		.object({
			op: z.literal("update"),
			id: makeIdSchema(),
			label: z.string().max(80).optional(),
			content: makeContentSchema().optional().describe(AS_IN_INSERT),
			styles: makeStylesSchema().optional().describe(AS_IN_INSERT),
			fillBehind: z.boolean().optional().describe(AS_IN_INSERT),
		})
		.strict();
const makeDeleteOp = () => z.object({ op: z.literal("delete"), id: makeIdSchema() }).strict();
const makeMoveOp = () =>
	z.object({ op: z.literal("move"), id: makeIdSchema(), parentId: makeParentIdSchema(), index: makeIndexSchema() }).strict();
const makeReplaceOp = () =>
	z
		.object({
			op: z.literal("replace"),
			id: makeIdSchema(),
			label: makeOpLabel(),
			block: makeBlockSpecSchema({ described: false }).describe(AS_IN_INSERT),
		})
		.strict();

/** A fresh, described schema for one new block (with its children), for tools that take blocks outside `change_blocks`. */
export const createBlockSpecSchema = (): ReturnType<typeof makeBlockSpecSchema> => makeBlockSpecSchema();

export const changeOpSchema = z.discriminatedUnion("op", [
	makeInsertOp(),
	makeUpdateOp(),
	makeDeleteOp(),
	makeMoveOp(),
	makeReplaceOp(),
]);

export type ChangeOp = z.infer<typeof changeOpSchema>;

/** Input of `change_blocks`. */
export const changeBlocksShape = {
	ops: z
		.array(changeOpSchema, {
			invalid_type_error:
				"ops must be a list of op objects. If you can only send it as text, it must be valid JSON: every { and [ needs exactly one matching } or ].",
		})
		.min(1, "Send at least one op.")
		.max(MAX_OPS_PER_CALL, `At most ${MAX_OPS_PER_CALL} ops per call. Split the work into several calls.`)
		.describe("Changes, applied in order, all or none."),
};
