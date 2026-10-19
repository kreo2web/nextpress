/**
 * Tree normalizing now lives in `shared/page-tools/` (one copy for the editor, the server and
 * the SDK). This file keeps the SDK's public names.
 */
export { normalizeBlockSubtree, normalizeBlockTree } from "./shared-page-tools.js";
