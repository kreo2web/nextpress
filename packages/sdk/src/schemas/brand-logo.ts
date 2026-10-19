import { z } from "zod";
import { isSvglFileUrl } from "../blocks/shared-rules.js";

/**
 * Checks the logo address with the server's own `isSvglFileUrl` (through `blocks/shared-rules.ts`):
 * only a logo file on svgl.app passes, so a bad address fails here instead of after a round trip.
 */
export const copyBrandLogoSchema = z.object({
	url: z.string().trim().refine(isSvglFileUrl, {
		message: "Use a brand logo address from svgl.app, such as https://svgl.app/library/github.svg.",
	}),
	/** Becomes the logo's alt text. The server keeps the first 120 characters. */
	title: z.string().trim().optional(),
});
