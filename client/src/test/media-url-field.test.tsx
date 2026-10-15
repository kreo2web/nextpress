import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MediaUrlField } from "@/components/PageBuilder/blocks/shared/media-url-field";

vi.mock("@/components/media/MediaPickerDialog", () => ({
	default: () => null,
}));

describe("MediaUrlField", () => {
	it("shows a picture when the address is a safe image", () => {
		const { container } = render(
			<MediaUrlField
				id="pic"
				label="Picture"
				kind="image"
				value="/uploads/hero.jpg"
				onChange={vi.fn()}
				onLibrarySelect={vi.fn()}
			/>,
		);

		expect(container.querySelector("img")).toHaveAttribute("src", "/uploads/hero.jpg");
		expect(screen.getByLabelText("Picture")).toHaveValue("/uploads/hero.jpg");
	});

	it("does not paint an unsafe address", () => {
		render(
			<MediaUrlField
				id="pic"
				label="Picture"
				kind="image"
				value="javascript:alert(1)"
				onChange={vi.fn()}
				onLibrarySelect={vi.fn()}
			/>,
		);

		expect(screen.queryByRole("img")).not.toBeInTheDocument();
	});

	it("shows a YouTube still for a video address", () => {
		const { container } = render(
			<MediaUrlField
				id="vid"
				label="Video"
				kind="video"
				value="https://www.youtube.com/watch?v=dQw4w9wgGcQ"
				onChange={vi.fn()}
				onLibrarySelect={vi.fn()}
			/>,
		);

		expect(container.querySelector("img")).toHaveAttribute(
			"src",
			"https://i.ytimg.com/vi/dQw4w9wgGcQ/hqdefault.jpg",
		);
	});
});
