/**
 * What a linked template part can be: one layout or container block with anything inside it.
 * The server refuses any other shape, so the SDK checks it first and fails with a plain message
 * instead of a round trip. The rule lives in `shared/template-parts/template-part-root.ts` and
 * reaches the SDK through `blocks/shared-rules.ts`, so there is one copy.
 */
export {
	DEFAULT_TEMPLATE_ROOT,
	readTemplateRoot,
	TEMPLATE_ROOT_BLOCK_NAMES,
	TEMPLATE_ROOT_MESSAGE,
	type TemplateRootBlockName,
	type TemplateRootCandidate,
} from "../blocks/shared-rules.js";
