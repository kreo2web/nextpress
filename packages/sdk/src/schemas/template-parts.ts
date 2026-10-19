import { z } from "zod";
import {
	readTemplateRoot,
	TEMPLATE_ROOT_BLOCK_NAMES,
	TEMPLATE_ROOT_MESSAGE,
	type TemplateRootCandidate,
} from "../types/template-part-root.js";
import { blockConfigSchema, paginationSchema } from "./index.js";

export const templateRootBlockNameSchema = z.enum(TEMPLATE_ROOT_BLOCK_NAMES);

export const listTemplatePartsQuerySchema = paginationSchema.extend({
	siteId: z.string().uuid().optional(),
});

/**
 * Either ready-made `blocks` or a `rootBlock` name to start from, never both. Ready-made blocks
 * must be exactly one layout or container block, because that is what the server accepts.
 */
export const createTemplatePartSchema = z
	.object({
		name: z.string().trim().min(1),
		blocks: z.array(blockConfigSchema).optional(),
		rootBlock: templateRootBlockNameSchema.optional(),
	})
	.superRefine((value, ctx) => {
		if (value.blocks === undefined) return;
		if (value.rootBlock !== undefined) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["rootBlock"],
				message: "Give either blocks or rootBlock, not both.",
			});
			return;
		}
		// blockConfigSchema has already confirmed every block has a name and optional children.
		if (!readTemplateRoot(value.blocks as TemplateRootCandidate[])) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["blocks"],
				message: TEMPLATE_ROOT_MESSAGE,
			});
		}
	});
