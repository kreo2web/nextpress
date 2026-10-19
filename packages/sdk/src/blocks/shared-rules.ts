/**
 * The one place the SDK reads two rules the server also enforces: which blocks a template part
 * may start with, and which logo addresses may be copied. Everything else in the SDK imports
 * them from here (through `types/template-part-root.ts` and `schemas/brand-logo.ts`), never
 * from `shared/` directly.
 *
 * WHY a bridge and not a copy: the SDK checks these rules before a request so a bad input fails
 * with a plain message instead of a round trip. One copy in `shared/` means the check and the
 * server cannot disagree. Each value is re-typed with the SDK's own types, once, here; the build
 * guard (`scripts/check-dist.mjs`) fails if a `shared/` or React path ever leaks into `dist/`.
 */

import { isSvglFileUrl } from "../../../../shared/icon-drawing.js";
import {
	DEFAULT_TEMPLATE_ROOT,
	readTemplateRoot as readSharedTemplateRoot,
	TEMPLATE_ROOT_BLOCK_NAMES,
	TEMPLATE_ROOT_MESSAGE,
	type TemplateRootBlockName,
} from "../../../../shared/template-parts/template-part-root.js";

export { DEFAULT_TEMPLATE_ROOT, isSvglFileUrl, TEMPLATE_ROOT_BLOCK_NAMES, TEMPLATE_ROOT_MESSAGE };
export type { TemplateRootBlockName };

/** The least a block needs for the root check. Real blocks have more; extra fields are ignored. */
export type TemplateRootCandidate = {
	name: string;
	children?: readonly TemplateRootCandidate[];
};

/**
 * The template's one layout block, or null when its top level (inside a page shell, if any) is
 * not exactly one layout or container block.
 */
// Cast: the shared function is typed with the app's `BlockConfig`; it only reads `name` and `children`.
export const readTemplateRoot = readSharedTemplateRoot as (
	blocks: readonly TemplateRootCandidate[],
) => TemplateRootCandidate | null;
