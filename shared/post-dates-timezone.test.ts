import { describe, expect, it } from "vitest";
import { formatPostInfoDate, formatPostListDate, readTimeZone } from "./post-info-date";

describe("post dates in the site's timezone", () => {
	// 23:30 UTC on Oct 18 is already Oct 19 in Kampala (UTC+3).
	const lateNight = "2026-10-18T23:30:00Z";

	it("shows the day the site's own clock says", () => {
		expect(formatPostInfoDate(lateNight, "long", "Africa/Kampala")).toBe("October 19, 2026");
		expect(formatPostInfoDate(lateNight, "long", "UTC")).toBe("October 18, 2026");
		expect(formatPostListDate(lateNight, "Africa/Kampala")).toBe("Oct 19, 2026");
	});

	it("ignores a timezone it doesn't know instead of breaking the page", () => {
		expect(readTimeZone("Mars/Olympus")).toBeUndefined();
		expect(() => formatPostInfoDate(lateNight, "short", "Mars/Olympus")).not.toThrow();
	});
});
