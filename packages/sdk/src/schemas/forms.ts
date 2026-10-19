import { z } from "zod";
import { paginationSchema, uuidSchema } from "./index.js";

/** The only two states the server accepts. */
export const formSubmissionStatusSchema = z.enum(["new", "read"]);

const formNameSchema = z.string().min(1).max(200);

export const listFormSubmissionsQuerySchema = paginationSchema.extend({
	form: formNameSchema.optional(),
	status: formSubmissionStatusSchema.optional(),
	siteId: z.string().uuid().optional(),
});

export const exportFormSubmissionsQuerySchema = z.object({
	form: formNameSchema.optional(),
	siteId: z.string().uuid().optional(),
});

export const markFormSubmissionStatusSchema = z.object({
	id: uuidSchema,
	status: formSubmissionStatusSchema,
});
