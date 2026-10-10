import type { BlockConfig } from "../schema-types.js";
import { unwrapPageShells } from "./template-part-tree.js";

/**
 * What a linked template can be: one layout or container block, with anything inside it. On a page
 * the template then fills one slot like any other layout block, so it lines up with the blocks
 * around it whatever it holds (a header, a footer, a sign-up box, a price table…).
 */
export const TEMPLATE_ROOT_BLOCK_NAMES = [
	"core/group",
	"core/stack",
	"core/columns",
	"core/container",
	"core/header",
	"core/accordion",
	"core/popup",
	"core/form",
] as const;

export type TemplateRootBlockName = (typeof TEMPLATE_ROOT_BLOCK_NAMES)[number];

/** The block a new template starts as when nobody picks one. */
export const DEFAULT_TEMPLATE_ROOT: TemplateRootBlockName = "core/group";

/** What a refused save says, in plain words. */
export const TEMPLATE_ROOT_MESSAGE =
	"A template is one layout block (a Group, Stack, Columns, Container, Header, Accordion, Popup or Form) with everything inside it. Move the other blocks into it, then save.";

export const isTemplateRootBlockName = (name: string): name is TemplateRootBlockName =>
	(TEMPLATE_ROOT_BLOCK_NAMES as readonly string[]).includes(name);

/**
 * The template's one layout block, or null when its top level (inside the editor's page shell) is
 * not exactly one layout or container block.
 */
export function readTemplateRoot(blocks: readonly BlockConfig[]): BlockConfig | null {
	const top = unwrapPageShells(blocks);
	if (top.length !== 1) return null;
	const root = top[0];
	return root && isTemplateRootBlockName(root.name) ? root : null;
}
