import { randomUUID } from "node:crypto";
import { buildBlockFromSpec, type BlockConfig, type BlockSpec } from "@nextpress-org/sdk";

/**
 * Turns block descriptions into ready-made blocks for `create_page` or `create_template_part`,
 * with the same builder `change_page_blocks` uses: each block starts exactly as the editor would
 * insert it, then the description's content and styles are laid over it.
 *
 * WHY the shared builder: an agent learns one block shape for every tool, and a block made here
 * matches one an agent adds to a page later.
 */
export function buildBlocksFromSpecs(specs: BlockSpec[]): BlockConfig[] {
	return specs.map((spec, index) => {
		const built = buildBlockFromSpec({ spec, parentId: null, newId: randomUUID });
		if (!built.ok) throw new Error(`blocks[${index}]: ${built.message}`);
		return built.value;
	});
}
