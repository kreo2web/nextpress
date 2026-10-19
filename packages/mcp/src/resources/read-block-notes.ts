import { createPageTools } from "@nextpress-org/sdk";
import { createNoPageContext } from "../tools/page-tool-context.js";

/** `list_block_types` writes one block per line: name | label | kind | category | note. */
const FIELD_SEPARATOR = " | ";
const FIELDS_BEFORE_NOTE = 4;

/**
 * Block name to the note on when to use it. The SDK does not export its block catalog, so the
 * notes are read from the `list_block_types` tool, which prints them. A test checks that every
 * block comes back with a note, so a change to that text fails loudly instead of dropping notes.
 */
export async function readBlockAgentNotes(): Promise<Record<string, string>> {
	const tool = createPageTools(createNoPageContext()).find(
		(candidate) => candidate.name === "list_block_types",
	);
	if (!tool) throw new Error("The shared page tools have no list_block_types tool.");
	const { text } = await tool.run({});
	return Object.fromEntries(
		text.split("\n").flatMap((line) => {
			const fields = line.split(FIELD_SEPARATOR);
			const note = fields.slice(FIELDS_BEFORE_NOTE).join(FIELD_SEPARATOR);
			return fields[0] && note ? [[fields[0], note]] : [];
		}),
	);
}
