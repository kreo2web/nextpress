import type { BlockConfig, BlockContent } from "../schema-types.js";
import {
	DEFAULT_FORM_FIELD_STYLES,
	DEFAULT_INPUT_CONTENT,
	DEFAULT_SELECT_CONTENT,
	DEFAULT_TEXTAREA_CONTENT,
} from "../form-field-model.js";
import { DEFAULT_FORM_CONTENT } from "../form-model.js";
import { newBlockOther, structured } from "./content.js";
import type { StartingChildrenParams, WrittenBlockEntry } from "./types.js";

/** A new form asks for a name, an email and a message, with a Send button that submits it. */
const buildStarterFormChildren = ({ parentId, newId }: StartingChildrenParams): BlockConfig[] => {
	const base = { parentId, type: "block" as const, settings: {}, other: newBlockOther() };
	const field = (name: string, blockName: string, label: string, data: Record<string, unknown>): BlockConfig => ({
		...base,
		id: newId(),
		name: blockName,
		label,
		category: "form",
		content: { kind: "structured", data: { name, label, ...data } },
		styles: {},
	});
	// Same shape the button block reads: text plus what the button does.
	const sendContent: BlockContent & { action: "submit"; url: string } = { kind: "text", value: "Send", action: "submit", url: "" };
	return [
		field("name", "core/input", "Text field", { label: "Your name", type: "text", placeholder: "e.g. John Doe" }),
		field("email", "core/input", "Text field", {
			label: "Your email",
			type: "email",
			placeholder: "e.g. john@acme.com",
			required: true,
		}),
		field("message", "core/textarea", "Text area", { label: "Message", placeholder: "Text here", rows: 4 }),
		{
			...base,
			id: newId(),
			name: "core/button",
			label: "Button",
			category: "basic",
			content: sendContent,
			styles: {},
		},
	];
};

export const FORM_BLOCKS: readonly WrittenBlockEntry[] = [
	{
		name: "core/form",
		label: "Form",
		description: "Collect sign-ups and messages; they appear in Forms",
		category: "form",
		kind: "container",
		defaultContent: () => structured(DEFAULT_FORM_CONTENT),
		// Same starting point as a Group, so the Layout panel shows direction, gap and alignment at once;
		// fields stretch to the form's width.
		defaultStyles: {
			width: "100%",
			boxSizing: "border-box",
			display: "flex",
			flexDirection: "column",
			gap: "12px",
			alignItems: "stretch",
			justifyContent: "flex-start",
			margin: "0",
		},
		defaultChildren: buildStarterFormChildren,
	},
	{
		name: "core/input",
		label: "Text field",
		description: "Single-line text, search, email, or number input",
		category: "form",
		kind: "block",
		defaultContent: () => structured(DEFAULT_INPUT_CONTENT),
		defaultStyles: DEFAULT_FORM_FIELD_STYLES,
	},
	{
		name: "core/textarea",
		label: "Text area",
		description: "Multi-line text input",
		category: "form",
		kind: "block",
		defaultContent: () => structured(DEFAULT_TEXTAREA_CONTENT),
		defaultStyles: DEFAULT_FORM_FIELD_STYLES,
	},
	{
		name: "core/select",
		label: "Dropdown",
		description: "Select one option from a list",
		category: "form",
		kind: "block",
		defaultContent: () => structured(DEFAULT_SELECT_CONTENT),
		defaultStyles: DEFAULT_FORM_FIELD_STYLES,
	},
];
