import { describe, expect, it } from "vitest";
import { readDispositionFileName, readDownloadedFile } from "./read-downloaded-file.js";

describe("readDispositionFileName", () => {
	it.each([
		['attachment; filename="about.nextpress-page.json"', "about.nextpress-page.json"],
		["attachment; filename=plain.csv", "plain.csv"],
		['attachment; filename="two words.json"; size=12', "two words.json"],
		['attachment; FILENAME="Upper.json"', "Upper.json"],
		['attachment; filename="../../etc/evil.json"', "evil.json"],
		['attachment; filename="C:\\\\temp\\\\win.json"', "win.json"],
	])("reads the name from %s", (header, expected) => {
		expect(readDispositionFileName(header)).toBe(expected);
	});

	it.each([
		[null],
		[""],
		["inline"],
		['attachment; filename=""'],
		['attachment; filename="../"'],
	])("returns null when %s names nothing usable", (header) => {
		expect(readDispositionFileName(header)).toBeNull();
	});
});

describe("readDownloadedFile", () => {
	it("returns the exact bytes, the name and the content type", async () => {
		const bytes = new Uint8Array([200, 0, 13, 10, 255]);
		const response = new Response(bytes, {
			headers: {
				"content-type": "text/csv",
				"content-disposition": 'attachment; filename="a.csv"',
			},
		});

		const file = await readDownloadedFile(response);

		expect(Array.from(file.bytes)).toEqual([200, 0, 13, 10, 255]);
		expect(file).toMatchObject({ fileName: "a.csv", contentType: "text/csv" });
	});

	it("falls back to a generic content type and no name", async () => {
		const response = new Response(new Uint8Array([1]));
		response.headers.delete("content-type");

		const file = await readDownloadedFile(response);

		expect(file.fileName).toBeNull();
		expect(file.contentType).toBe("application/octet-stream");
	});
});
