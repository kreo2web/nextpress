import type { z } from "zod";
import type { listTemplatePartsQuerySchema } from "../schemas/template-parts.js";
import type { BlockConfig, Template } from "./domain.js";
import type { TemplateRootBlockName } from "./template-part-root.js";

export type { TemplateRootBlockName } from "./template-part-root.js";

/** What the server writes on a linked part: which kind of template it is and which site owns it. */
export type TemplatePartMarker = { usage: "part"; siteId: string };

/** A linked template part: one layout block that pages show through a `core/template-part` block. */
export type TemplatePart = Omit<Template, "type" | "blocks"> & {
	type: "part";
	blocks?: BlockConfig[] | null;
	other?: TemplatePartMarker | null;
};

/** A part in the list, with the number of pages of the site that show it. */
export type TemplatePartListItem = TemplatePart & { usedOnPages: number };

/** A page that shows a part. Drafts count; trashed pages do not. */
export type TemplatePartUsagePage = {
	id: string;
	title: string;
	status: string | null;
};

export type TemplatePartUsage = { pages: TemplatePartUsagePage[] };

export type ListTemplatePartsQuery = z.infer<typeof listTemplatePartsQuerySchema>;

/**
 * Input for `templates.createPart`. Give ready-made `blocks` (exactly one layout or container
 * block) or a `rootBlock` name to start from, not both. With neither, the part starts as a Group.
 */
export type CreateTemplatePartInput = {
	name: string;
	blocks?: BlockConfig[];
	rootBlock?: TemplateRootBlockName;
};
