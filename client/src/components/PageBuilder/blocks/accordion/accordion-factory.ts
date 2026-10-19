/**
 * The new-item builder lives in the shared block list so the editor, the server and the SDK
 * make the same accordion items. Settings import it from here to keep their imports local.
 */
export { buildAccordionItem } from "@shared/block-catalog/layout-blocks";
