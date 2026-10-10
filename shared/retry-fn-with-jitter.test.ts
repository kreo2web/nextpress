import { describe, expect, it } from "vitest";
import { jitteredDelayMs, retryFnWithJitter } from "./retry-fn-with-jitter";

/** A fake clock: sleeping only moves time forward, so tests run instantly and deterministically. */
const createClock = () => {
	let time = 0;
	const waits: number[] = [];
	return {
		now: () => time,
		sleep: async (ms: number) => {
			waits.push(ms);
			time += ms;
		},
		waits,
	};
};

describe("jitteredDelayMs", () => {
	it("doubles each time, stays between half and all of the cap, and never exceeds the max", () => {
		expect(jitteredDelayMs({ attempt: 1, baseDelayMs: 1000, maxDelayMs: 10_000, random: () => 0 })).toBe(500);
		expect(jitteredDelayMs({ attempt: 1, baseDelayMs: 1000, maxDelayMs: 10_000, random: () => 1 })).toBe(1000);
		expect(jitteredDelayMs({ attempt: 3, baseDelayMs: 1000, maxDelayMs: 10_000, random: () => 1 })).toBe(4000);
		expect(jitteredDelayMs({ attempt: 9, baseDelayMs: 1000, maxDelayMs: 10_000, random: () => 1 })).toBe(10_000);
		expect(jitteredDelayMs({ attempt: 9, baseDelayMs: 1000, maxDelayMs: 10_000, random: () => 0 })).toBe(5000);
	});
});

describe("retryFnWithJitter", () => {
	it("returns as soon as a try succeeds, waiting a jittered, growing time between tries", async () => {
		const clock = createClock();
		let calls = 0;
		const result = await retryFnWithJitter({
			fn: async (attempt) => {
				calls += 1;
				if (attempt < 3) throw new Error("not yet");
				return "up";
			},
			baseDelayMs: 1000,
			maxDelayMs: 10_000,
			maxDurationMs: 60_000,
			sleep: clock.sleep,
			now: clock.now,
			random: () => 0.5,
		});
		expect(result).toBe("up");
		expect(calls).toBe(3);
		expect(clock.waits).toEqual([750, 1500]);
	});

	it("gives up with the last error once the time budget would run out", async () => {
		const clock = createClock();
		await expect(
			retryFnWithJitter({
				fn: async (attempt) => {
					throw new Error(`down ${attempt}`);
				},
				baseDelayMs: 1000,
				maxDelayMs: 2000,
				maxDurationMs: 5000,
				sleep: clock.sleep,
				now: clock.now,
				random: () => 1,
			}),
		).rejects.toThrow("down 4");
		expect(clock.now()).toBeLessThanOrEqual(5000);
	});

	it("stops at once when the error is not worth retrying", async () => {
		const clock = createClock();
		let calls = 0;
		await expect(
			retryFnWithJitter({
				fn: async () => {
					calls += 1;
					throw new Error("signed out");
				},
				baseDelayMs: 1000,
				maxDelayMs: 2000,
				maxDurationMs: 60_000,
				shouldRetry: (error) => error.message !== "signed out",
				sleep: clock.sleep,
				now: clock.now,
			}),
		).rejects.toThrow("signed out");
		expect(calls).toBe(1);
	});

	it("stops when the caller aborts", async () => {
		const clock = createClock();
		const controller = new AbortController();
		await expect(
			retryFnWithJitter({
				fn: async () => {
					controller.abort();
					throw new Error("down");
				},
				baseDelayMs: 1000,
				maxDelayMs: 2000,
				maxDurationMs: 60_000,
				signal: controller.signal,
				sleep: clock.sleep,
				now: clock.now,
			}),
		).rejects.toThrow("Stopped before it finished");
	});
});
