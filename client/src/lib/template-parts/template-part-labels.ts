import { readTemplateRoot, type TemplateRootBlockName, TEMPLATE_ROOT_BLOCK_NAMES } from "@shared/template-parts";
import { readTemplateBlocks } from "./read-template-blocks";

/** The editor's names for the layout blocks a template can be (kept here so admin pages don't load every block). */
const ROOT_LABELS: Record<TemplateRootBlockName, string> = {
	"core/group": "Group",
	"core/stack": "Stack",
	"core/columns": "Columns",
	"core/container": "Container",
	"core/header": "Header",
	"core/accordion": "Accordion",
	"core/popup": "Popup",
	"core/form": "Form",
};

/** The layout blocks a new template can start as, with the words the admin sees. */
export const TEMPLATE_ROOT_OPTIONS: { value: TemplateRootBlockName; label: string }[] = TEMPLATE_ROOT_BLOCK_NAMES.map(
	(name) => ({ value: name, label: ROOT_LABELS[name] }),
);

/**
 * What a template is, named by its one layout block ("Group", "Columns"…). A template that isn't
 * one layout block yet (e.g. saved before the rule) reads as "Template", so nothing is hidden.
 */
export const templateRootLabel = (blocks: unknown): string => {
	const root = readTemplateRoot(readTemplateBlocks(blocks));
	return root ? (ROOT_LABELS[root.name as TemplateRootBlockName] ?? root.name) : "Template";
};

/** "Used on 3 pages", "Used on 1 page", or "Not used yet". */
export const usedOnPagesLabel = (count: number): string => {
	if (count <= 0) return "Not used yet";
	return count === 1 ? "Used on 1 page" : `Used on ${count} pages`;
};

/** Where the builder opens a template for editing. */
export const templateEditorPath = (templateId: string): string =>
	`/admin/page-builder/template/${encodeURIComponent(templateId)}`;
