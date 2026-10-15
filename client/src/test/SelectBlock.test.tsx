import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SelectBlock from "@/components/PageBuilder/blocks/select/SelectBlock";
import type { BlockConfig, BlockContent } from "@shared/schema-types";
import type { SelectOption } from "@shared/form-field-model";

const SelectSettings = SelectBlock.settings;

if (!SelectSettings) {
	throw new Error("Dropdown is missing settings");
}

function structured(data: {
	label?: string;
	name?: string;
	defaultValue?: string;
	options?: SelectOption[];
}): BlockContent {
	return { kind: "structured", data };
}

function createSelectBlock(data: {
	label?: string;
	name?: string;
	defaultValue?: string;
	options?: SelectOption[];
} = {}): BlockConfig {
	return {
		id: "sel-1",
		name: "core/select",
		type: "block",
		parentId: null,
		label: "Dropdown",
		content: structured(data),
		styles: {},
		children: [],
		settings: {},
	};
}

describe("SelectBlock settings", () => {
	it("uses the shared field shell, no Settings card, and default radius on choice rows", () => {
		render(
			<SelectSettings
				block={createSelectBlock({
					label: "How have you used WordPress?",
					options: [{ label: "Option one", value: "option-1" }],
				})}
				onUpdate={vi.fn()}
			/>,
		);

		expect(screen.getByLabelText("Label")).toBeInTheDocument();
		expect(screen.getByPlaceholderText("Label")).toBeInTheDocument();
		expect(screen.getByPlaceholderText("Value")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Add option" })).toBeInTheDocument();
		expect(screen.queryByText("Settings")).not.toBeInTheDocument();
		expect(screen.queryByText("Field name")).not.toBeInTheDocument();
		expect(screen.getByPlaceholderText("Label").className).not.toMatch(/rounded-none/);
		expect(screen.getByPlaceholderText("Value").className).not.toMatch(/rounded-none/);
		expect(screen.getByRole("button", { name: "Add option" }).className).not.toMatch(
			/rounded-none/,
		);
		expect(screen.getByRole("button", { name: "Remove option" }).className).not.toMatch(
			/rounded-none/,
		);
	});

	it("warns when the default matches no remaining labeled choice, and does not rewrite it", () => {
		const onUpdate = vi.fn();
		render(
			<SelectSettings
				block={createSelectBlock({
					options: [
						{ label: "One", value: "one" },
						{ label: "", value: "gone" },
					],
					defaultValue: "gone",
				})}
				onUpdate={onUpdate}
			/>,
		);

		expect(screen.getByText("The default does not match a choice.")).toBeInTheDocument();
		expect(onUpdate).not.toHaveBeenCalled();
	});

	it("stays quiet when the default is empty or matches a labeled choice", () => {
		const { rerender } = render(
			<SelectSettings
				block={createSelectBlock({
					options: [{ label: "One", value: "one" }],
					defaultValue: "",
				})}
				onUpdate={vi.fn()}
			/>,
		);
		expect(screen.queryByText("The default does not match a choice.")).not.toBeInTheDocument();

		rerender(
			<SelectSettings
				block={createSelectBlock({
					options: [{ label: "One", value: "one" }],
					defaultValue: "one",
				})}
				onUpdate={vi.fn()}
			/>,
		);
		expect(screen.queryByText("The default does not match a choice.")).not.toBeInTheDocument();
	});
});
