import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FormFieldSettings } from "@/components/PageBuilder/blocks/form/form-field-settings";
import InputBlock from "@/components/PageBuilder/blocks/input/InputBlock";
import { DEFAULT_INPUT_CONTENT } from "@shared/form-field-model";
import type { BlockConfig, BlockContent } from "@shared/schema-types";

const InputSettings = InputBlock.settings;

if (!InputSettings) {
	throw new Error("Text field is missing settings");
}

function structured(data: { [key: string]: string | boolean }): BlockContent {
	return { kind: "structured", data };
}

function createInputBlock(data: { [key: string]: string | boolean } = {}): BlockConfig {
	return {
		id: "fld-1",
		name: "core/input",
		type: "block",
		parentId: null,
		label: "Text field",
		content: structured(data),
		styles: {},
		children: [],
		settings: {},
	};
}

describe("FormFieldSettings", () => {
	it("uses one section, no Settings card, and the default input radius", () => {
		render(
			<FormFieldSettings
				block={createInputBlock({ label: "Email" })}
				defaultContent={DEFAULT_INPUT_CONTENT}
				onUpdate={vi.fn()}
			/>,
		);

		expect(screen.getByLabelText("Label")).toBeInTheDocument();
		expect(screen.getByLabelText("Placeholder")).toBeInTheDocument();
		expect(screen.getByLabelText("Required")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "More" })).toBeInTheDocument();
		expect(screen.queryByText("Field name")).not.toBeInTheDocument();
		expect(screen.queryByText("Settings")).not.toBeInTheDocument();
		expect(
			screen.queryByText("Width, colors, and borders are in the Style tab."),
		).not.toBeInTheDocument();
		expect(screen.getByLabelText("Label").className).not.toMatch(/rounded-none/);
		expect(screen.getByLabelText("Placeholder").className).not.toMatch(/rounded-none/);
	});

	it("keeps answer name out of the main group until More is opened", async () => {
		const user = userEvent.setup();
		render(
			<FormFieldSettings
				block={createInputBlock({ label: "Email" })}
				defaultContent={DEFAULT_INPUT_CONTENT}
				onUpdate={vi.fn()}
			/>,
		);

		expect(screen.queryByLabelText("Answer name")).not.toBeInTheDocument();
		expect(screen.queryByLabelText("Default value")).not.toBeInTheDocument();
		expect(screen.queryByLabelText("Accessible label")).not.toBeInTheDocument();
		expect(screen.queryByLabelText("Disabled")).not.toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: "More" }));

		expect(screen.getByLabelText("Answer name")).toBeInTheDocument();
		expect(screen.getByLabelText("Default value")).toBeInTheDocument();
		expect(screen.getByLabelText("Accessible label")).toBeInTheDocument();
		expect(screen.getByLabelText("Disabled")).toBeInTheDocument();
		expect(screen.getByLabelText("Answer name").className).not.toMatch(/rounded-none/);
	});

	it("opens More when answer name, default, accessible label, or disabled is already set", () => {
		render(
			<FormFieldSettings
				block={createInputBlock({ name: "email", defaultValue: "hi" })}
				defaultContent={DEFAULT_INPUT_CONTENT}
				onUpdate={vi.fn()}
			/>,
		);

		expect(screen.getByLabelText("Answer name")).toHaveValue("email");
		expect(screen.getByLabelText("Default value")).toHaveValue("hi");
	});

	it("keeps type and required in the main group for a text field", () => {
		render(<InputSettings block={createInputBlock({ label: "Email" })} onUpdate={vi.fn()} />);

		expect(screen.getByLabelText("Input type")).toBeInTheDocument();
		expect(screen.getByLabelText("Required")).toBeInTheDocument();
		expect(screen.queryByText("Field name")).not.toBeInTheDocument();
		expect(screen.queryByText("Settings")).not.toBeInTheDocument();
		expect(screen.getByLabelText("Input type").className).not.toMatch(/rounded-none/);
	});
});
