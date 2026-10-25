import { type BlockData } from "../content-text/html-text.js";
import { readBlockContentData } from "../read-block-content.js";
import type { BlockConfig } from "../schema-types.js";

/** A block's saved fields, in the shape the text and list readers take. */
export const dataOf = (block: BlockConfig): BlockData => readBlockContentData(block.content) as BlockData;
