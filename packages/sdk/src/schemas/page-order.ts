import { z } from "zod";
import { uuidSchema } from "./index.js";

/** The most pages one reorder call can move (the server refuses more). */
export const MAX_REORDER_ITEMS = 100;

export const reorderPagesSchema = z.object({
	siteId: z.string().uuid(),
	items: z
		.array(
			z.object({
				id: uuidSchema,
				menuOrder: z.number().int().min(0),
			}),
		)
		.min(1)
		.max(MAX_REORDER_ITEMS),
});
