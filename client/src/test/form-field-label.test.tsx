import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormFieldLabel, formFieldControlId, formFieldHelpId } from "@shared/form-field-label";

describe("FormFieldLabel", () => {
	it("draws help under the label", () => {
		const controlId = formFieldControlId("email-1");
		render(<FormFieldLabel label="Email" htmlFor={controlId} help="We never share this" />);
		expect(screen.getByText("Email")).toBeInTheDocument();
		const help = screen.getByText("We never share this");
		expect(help.tagName).toBe("P");
		expect(help).toHaveAttribute("id", formFieldHelpId(controlId));
	});

	it("draws nothing when label and help are blank", () => {
		const { container } = render(<FormFieldLabel label="  " htmlFor="x" help="  " />);
		expect(container).toBeEmptyDOMElement();
	});
});
