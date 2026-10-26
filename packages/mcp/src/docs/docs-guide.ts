import { DOCS_MDX_CHEAT_SHEET } from "./docs-mdx-cheat-sheet.js";
import { DOCS_WRITING_GUIDE } from "./docs-writing-guide.js";

/** Where the docs guide is read as a resource. */
export const DOCS_GUIDE_URI = "nextpress://docs/guide";

/**
 * The whole guide an agent reads before it writes docs: the writing rules, then the MDX cheat sheet.
 * The `write_docs` prompt, the `nextpress://docs/guide` resource and the `get_docs_guide` tool all send
 * this one text, so an agent gets the same rules whichever way it asks.
 */
export const DOCS_GUIDE = [DOCS_WRITING_GUIDE, DOCS_MDX_CHEAT_SHEET].join("\n");
