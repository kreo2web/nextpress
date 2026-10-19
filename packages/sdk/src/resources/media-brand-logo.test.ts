import { describe, expect, it } from "vitest";
import { isNextpressError } from "../client/nextpress-error.js";
import { createTestClient, readCall, TEST_SITE_ID } from "../test/create-test-client.js";

const LOGO_URL = "https://svgl.app/library/github.svg";

const mediaRow = {
	id: "00000000-0000-4000-8000-0000000000e1",
	filename: "svgl-github.svg",
	originalName: "svgl-github.svg",
	mimeType: "image/svg+xml",
	size: 1200,
	url: "/uploads/svgl-123.svg",
	alt: "GitHub",
};

describe("media.copyBrandLogo", () => {
	it("posts the logo address and returns the saved media item", async () => {
		const { client, calls } = createTestClient([
			{
				method: "POST",
				path: "/api/media/svgl",
				handler: () => Response.json(mediaRow, { status: 201 }),
			},
		]);

		const media = await client.media.copyBrandLogo({ url: `  ${LOGO_URL}  `, title: "GitHub" });

		expect(media.url).toBe("/uploads/svgl-123.svg");
		expect(calls[0]?.method).toBe("POST");
		expect(calls[0]?.body).toEqual({ url: LOGO_URL, title: "GitHub" });
		expect(readCall(calls[0])).toEqual({
			pathname: "/api/media/svgl",
			query: { siteId: TEST_SITE_ID },
		});
	});

	it("sends no title when none is given, and accepts names with dashes and underscores", async () => {
		const { client, calls } = createTestClient([
			{ path: "/api/media/svgl", handler: () => Response.json(mediaRow) },
		]);

		await client.media.copyBrandLogo({ url: "https://svgl.app/library/cursor_light-v2.svg" });

		expect(calls[0]?.body).toEqual({ url: "https://svgl.app/library/cursor_light-v2.svg" });
	});

	it.each([
		["a plain http address", "http://svgl.app/library/github.svg"],
		["another site", "https://example.com/library/github.svg"],
		["a look-alike host", "https://svgl.app.evil.com/library/github.svg"],
		["a query string", `${LOGO_URL}?x=1`],
		["a fragment", `${LOGO_URL}#top`],
		["a file that is not an SVG", "https://svgl.app/library/github.png"],
		["a folder inside the library", "https://svgl.app/library/a/github.svg"],
		["a path outside the library", "https://svgl.app/other/github.svg"],
		["an empty address", ""],
		["text that is not an address", "github"],
	])("fails locally on %s, without calling the server", async (_label, url) => {
		const { client, calls } = createTestClient([]);

		await expect(client.media.copyBrandLogo({ url })).rejects.toThrow(
			"Invalid media.copyBrandLogo input: url: Use a brand logo address from svgl.app",
		);
		expect(calls).toHaveLength(0);
	});

	it("turns the server's refusal into a NextpressError", async () => {
		const message = "Too many logos at once. Wait a minute and try again.";
		const { client } = createTestClient([
			{ path: "/api/media/svgl", handler: () => Response.json({ message }, { status: 429 }) },
		]);

		const error = await client.media
			.copyBrandLogo({ url: LOGO_URL })
			.catch((caught: Error) => caught);

		expect(isNextpressError(error)).toBe(true);
		expect(error).toMatchObject({ status: 429, message });
	});

	it("turns a failed download into a NextpressError", async () => {
		const message = "That logo couldn't be downloaded right now. Try again in a moment.";
		const { client } = createTestClient([
			{ path: "/api/media/svgl", handler: () => Response.json({ message }, { status: 502 }) },
		]);

		const error = await client.media
			.copyBrandLogo({ url: LOGO_URL })
			.catch((caught: Error) => caught);

		expect(error).toMatchObject({ status: 502, message });
	});
});
