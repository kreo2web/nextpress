import { describe, expect, it } from "vitest";
import { createRunRegistry } from "../lib/ai-builder/run-registry";

const startOrFail = (registry: ReturnType<typeof createRunRegistry>) => {
	const started = registry.tryStart({ userId: "person-1" });
	if (!started.ok) throw new Error(`run refused: ${started.reason}`);
	return started.run;
};

describe("assistant run limits", () => {
	it("keeps one open run per person", () => {
		const registry = createRunRegistry();
		startOrFail(registry);
		expect(registry.tryStart({ userId: "person-1" })).toEqual({ ok: false, reason: "already_running" });
		expect(registry.tryStart({ userId: "person-2" }).ok).toBe(true);
	});

	it("Stop then send at once: the stopped run settling late leaves the new run alone", () => {
		const registry = createRunRegistry();
		const first = startOrFail(registry);

		// Stop closes the request, so the route aborts the first run and frees the slot.
		first.abort();
		const second = startOrFail(registry);

		// The first run's model call notices the abort a moment later and settles.
		first.finish();

		expect(registry.hasOpenRun({ userId: "person-1" })).toBe(true);
		expect(registry.tryStart({ userId: "person-1" })).toEqual({ ok: false, reason: "already_running" });

		// The first run's late Stop must not reach the second run.
		first.abort();
		expect(second.signal.aborted).toBe(false);

		second.abort();
		expect(second.signal.aborted).toBe(true);
		expect(registry.hasOpenRun({ userId: "person-1" })).toBe(false);
	});

	it("the time limit stops a run, and that run settling late leaves the next one alone", async () => {
		const registry = createRunRegistry({ runTimeoutMs: 5 });
		const first = startOrFail(registry);
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(first.signal.aborted).toBe(true);

		const second = startOrFail(registry);
		first.finish();
		expect(registry.hasOpenRun({ userId: "person-1" })).toBe(true);
		second.finish();
	});

	it("counts started runs against the hourly cap", () => {
		let clock = 0;
		const registry = createRunRegistry({ maxPerHour: 2, now: () => clock });
		startOrFail(registry).finish();
		startOrFail(registry).finish();
		expect(registry.tryStart({ userId: "person-1" })).toEqual({ ok: false, reason: "hourly_limit" });
		clock = 60 * 60 * 1000 + 1;
		expect(registry.tryStart({ userId: "person-1" }).ok).toBe(true);
	});
});
