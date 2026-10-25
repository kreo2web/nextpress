import type { BlockConfig } from "../schema-types.js";
import { CODE_GROUP_BLOCK_NAME } from "./code-group-model.js";
import { readStructuredData } from "./read-structured.js";
import { TABS_BLOCK_NAME } from "./tabs-model.js";

const MARKDOWN_BLOCK_NAME = "core/markdown";
const TABS_TAG = /<(?:Tabs|CodeGroup)[\s/>]/;

/**
 * True when this block needs `/vendor/tabs.js` on a published page: the Tabs and Code group
 * blocks, and a markdown block in MDX mode whose text uses `<Tabs>` or `<CodeGroup>`. Published
 * MDX has no React, so the script is what switches its tabs; loading it only when asked keeps
 * every other page lighter.
 */
export const blockNeedsTabsScript = (block: Pick<BlockConfig, "name" | "content">): boolean => {
	if (block.name === TABS_BLOCK_NAME || block.name === CODE_GROUP_BLOCK_NAME) return true;
	if (block.name !== MARKDOWN_BLOCK_NAME) return false;
	const data = readStructuredData(block.content);
	const text = typeof data.content === "string" ? data.content : typeof data.value === "string" ? data.value : "";
	return data.mdx === true && TABS_TAG.test(text);
};
