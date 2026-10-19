import { z } from "zod";
import { type BlockName, isBlockName } from "../block-catalog/block-names.js";

/** Most changes one `change_blocks` call may hold. */
export const MAX_OPS_PER_CALL = 50;
/** Most blocks one `change_blocks` call may create, starting children included. */
export const MAX_NEW_BLOCKS_PER_CALL = 300;

/**
 * Every schema piece here is a factory: each use builds its own instance. When the same zod
 * instance shows up twice in one composed schema, the MCP library's JSON output points at it
 * with `$ref`s, and some agents' JSON-schema readers are strict about those. Fresh instances
 * keep every tool's schema self-contained.
 */

const makeBlockNameSchema = () =>
	z
		.string()
		.refine(
			(name): name is BlockName => isBlockName(name),
			(name) => ({ message: `Unknown block name "${name}". Call list_block_types for the valid names.` }),
		)
		.describe("Block name from list_block_types, such as core/heading or core/stack.");

const makeContentSchema = () =>
	z
		.record(z.string(), z.unknown())
		.describe(
			'Content fields to set, e.g. {"value": "Hello", "level": 1}. Send only fields to set, never "kind" or "data" wrappers. Call get_block_type to see a block\'s fields. A null value removes the field.',
		);

const makeStylesSchema = () =>
	z
		.record(z.string(), z.union([z.string(), z.number(), z.null()]))
		.describe(
			'CSS properties in camelCase, e.g. {"gap": "1rem", "backgroundColor": "var(--npb-surface-raised)"}. A null value removes the property.',
		);

const makeSpecFields = () => ({
	name: makeBlockNameSchema(),
	label: z.string().max(80).optional().describe("Name shown in the editor's layers list."),
	content: makeContentSchema().optional(),
	styles: makeStylesSchema().optional(),
});

/**
 * A new block, up to four levels deep. Written out level by level instead of with a
 * recursive schema, because some AI providers reject recursive JSON schemas.
 */
const makeBlockSpecSchema = () => {
	const spec4 = z.object(makeSpecFields()).strict();
	const spec3 = z.object({ ...makeSpecFields(), children: z.array(spec4).optional() }).strict();
	const spec2 = z.object({ ...makeSpecFields(), children: z.array(spec3).optional() }).strict();
	return z
		.object({
			...makeSpecFields(),
			children: z
				.array(spec2)
				.optional()
				.describe(
					"Blocks inside this one (containers only). Replaces the block's starting children. Nesting goes four levels deep (this block plus three levels of children); build deeper trees with a second insert into the ids returned.",
				),
		})
		.strict();
};

const makeParentIdSchema = () =>
	z
		.string()
		.nullable()
		.describe("Id of the container to put the block in, or null for the page root. At the root, blocks go inside the page shell.");
const makeIndexSchema = () =>
	z.number().int().min(0).optional().describe("Position among the siblings, starting at 0. Leave out to add at the end.");
const makeIdSchema = () => z.string().min(1).describe("Id of an existing block, from get_page_outline.");

const makeInsertOp = () =>
	z.object({ op: z.literal("insert"), parentId: makeParentIdSchema(), index: makeIndexSchema(), block: makeBlockSpecSchema() }).strict();
const makeUpdateOp = () =>
	z
		.object({
			op: z.literal("update"),
			id: makeIdSchema(),
			label: z.string().max(80).optional(),
			content: makeContentSchema().optional(),
			styles: makeStylesSchema().optional(),
		})
		.strict();
const makeDeleteOp = () => z.object({ op: z.literal("delete"), id: makeIdSchema() }).strict();
const makeMoveOp = () =>
	z.object({ op: z.literal("move"), id: makeIdSchema(), parentId: makeParentIdSchema(), index: makeIndexSchema() }).strict();
const makeReplaceOp = () => z.object({ op: z.literal("replace"), id: makeIdSchema(), block: makeBlockSpecSchema() }).strict();

export const blockSpecSchema = makeBlockSpecSchema();

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
		.array(changeOpSchema)
		.min(1, "Send at least one op.")
		.max(MAX_OPS_PER_CALL, `At most ${MAX_OPS_PER_CALL} ops per call. Split the work into several calls.`)
		.describe("Changes, applied in order, all or none."),
};
