import { describe, expect, it } from "vitest";
import { createKeyedQueue } from "./run-in-order.js";

/** A job that finishes only when the test says so, and records when it started and ended. */
const makeJob = ({ name, log }: { name: string; log: string[] }) => {
	let finish: () => void = () => undefined;
	const gate = new Promise<void>((resolve) => {
		finish = resolve;
	});
	return {
		finish: () => finish(),
		job: async () => {
			log.push(`${name} start`);
			await gate;
			log.push(`${name} end`);
			return name;
		},
	};
};

const nextTick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("createKeyedQueue", () => {
	it("runs jobs with the same key one after another", async () => {
		const queue = createKeyedQueue();
		const log: string[] = [];
		const first = makeJob({ name: "first", log });
		const second = makeJob({ name: "second", log });

		const firstResult = queue({ key: "page:1", job: first.job });
		const secondResult = queue({ key: "page:1", job: second.job });
		await nextTick();
		expect(log).toEqual(["first start"]);

		first.finish();
		await nextTick();
		second.finish();

		expect(await Promise.all([firstResult, secondResult])).toEqual(["first", "second"]);
		expect(log).toEqual(["first start", "first end", "second start", "second end"]);
	});

	it("lets jobs with different keys run side by side", async () => {
		const queue = createKeyedQueue();
		const log: string[] = [];
		const a = makeJob({ name: "a", log });
		const b = makeJob({ name: "b", log });

		const results = Promise.all([queue({ key: "page:1", job: a.job }), queue({ key: "page:2", job: b.job })]);
		await nextTick();
		expect(log).toEqual(["a start", "b start"]);

		a.finish();
		b.finish();
		await results;
	});

	it("runs the next job even when the one before it failed, and hands the failure to its own caller", async () => {
		const queue = createKeyedQueue();

		const failing = queue({
			key: "page:1",
			job: async () => {
				throw new Error("save refused");
			},
		});
		const after = queue({ key: "page:1", job: async () => "saved" });

		await expect(failing).rejects.toThrow("save refused");
		await expect(after).resolves.toBe("saved");
	});
});
