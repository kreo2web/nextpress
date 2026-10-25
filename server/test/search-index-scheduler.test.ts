import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BlockConfig } from "@shared/schema-types";
import type { Deps } from "../routes/shared/deps";
import { SITE_PAGE_LIMIT } from "../lib/page-paths/page-paths";
import { createSiteSearchIndex, siteSearchIndexOf, scheduleSearchIndexRebuild } from "../lib/site-search";

const SITE_A = "550e8400-e29b-41d4-a716-446655440000";
const SITE_B = "550e8400-e29b-41d4-a716-446655440001";

type Row = { id: string; title: string; slug: string; status: string; password: string | null; parentId: string | null; blocks: BlockConfig[]; version: number; updatedAt: Date; siteId: string };

const paragraph = (id: string, value: string): BlockConfig =>
	({ id, name: "core/paragraph", type: "block", parentId: null, content: { kind: "text", value } }) as BlockConfig;

const row = (slug: string, overrides: Partial<Row> = {}): Row => ({
	id: `id-${slug}`,
	title: slug,
	slug,
	status: "publish",
	password: null,
	parentId: null,
	blocks: [paragraph(`p-${slug}`, `words on ${slug}`)],
	version: 1,
	updatedAt: new Date(1_000),
	siteId: SITE_A,
	...overrides,
});

/**
 * A stand-in for the pages table. `builds` counts reads made to build an index (the one read of
 * a whole site's pages); the fingerprint's two small queries are not counted. A gate holds a build
 * open so a test can make changes while one is running.
 */
const fakeSite = (initial: Row[]) => {
	const state = { rows: initial, builds: 0, running: 0, mostRunning: 0, gate: null as Promise<void> | null, failNext: false, clock: 2_000 };
	const inSite = (filters: { where: string; equals?: string }[]) =>
		state.rows.filter((r) => filters.every((f) => (r as Record<string, unknown>)[f.where] === f.equals));
	const models = {
		pages: {
			count: async ({ where }: { where: { where: string; equals?: string }[] }) => inSite(where).length,
			findManyWhere: async (filters: { where: string; equals?: string }[], options?: { limit?: number }) => {
				const rows = inSite(filters).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
				if (options?.limit !== SITE_PAGE_LIMIT) return rows.slice(0, options?.limit);
				state.builds += 1;
				state.running += 1;
				state.mostRunning = Math.max(state.mostRunning, state.running);
				try {
					if (state.gate) await state.gate;
					if (state.failNext) {
						state.failNext = false;
						throw new Error("the database went away");
					}
					return rows;
				} finally {
					state.running -= 1;
				}
			},
		},
	} as unknown as Deps["models"];
	/** What saving a page does to the table: a newer stamp and version, as every real save does. */
	const save = (id: string, changes: Partial<Row> = {}) => {
		state.clock += 1;
		state.rows = state.rows.map((r) => (r.id === id ? { ...r, ...changes, version: r.version + 1, updatedAt: new Date(state.clock) } : r));
	};
	const holdBuilds = () => {
		let release: () => void = () => undefined;
		state.gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		return () => {
			state.gate = null;
			release();
		};
	};
	return { models, state, save, holdBuilds };
};

/** Lets every promise that is ready run, without moving the clock. */
const settle = async (): Promise<void> => {
	await vi.advanceTimersByTimeAsync(0);
	await vi.advanceTimersByTimeAsync(0);
};

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("scheduling a rebuild", () => {
	it("returns at once and does no work until things have been quiet for about a second and a half", async () => {
		const site = fakeSite([row("install")]);
		const index = createSiteSearchIndex({ models: site.models, random: () => 0 });

		expect(index.schedule({ siteId: SITE_A })).toBeUndefined();
		await settle();
		expect(site.state.builds).toBe(0);

		await vi.advanceTimersByTimeAsync(1499);
		expect(site.state.builds).toBe(0);
		await vi.advanceTimersByTimeAsync(1);
		await settle();
		expect(site.state.builds).toBe(1);
	});

	it("adds a small random wait on top, never more than half a second", async () => {
		for (const [random, startsBy] of [[0, 1500], [0.999, 1900]] as const) {
			const site = fakeSite([row("install")]);
			const index = createSiteSearchIndex({ models: site.models, random: () => random });
			index.schedule({ siteId: SITE_A });
			await vi.advanceTimersByTimeAsync(startsBy - 1);
			expect(site.state.builds).toBe(0);
			await vi.advanceTimersByTimeAsync(1);
			await settle();
			expect(site.state.builds).toBe(1);
		}
	});

	it("starts the wait again on every change, so a burst of saves makes one build", async () => {
		const site = fakeSite([row("install")]);
		const index = createSiteSearchIndex({ models: site.models, random: () => 0 });
		for (let save = 0; save < 10; save += 1) {
			site.save("id-install");
			index.schedule({ siteId: SITE_A });
			await vi.advanceTimersByTimeAsync(1000);
		}
		expect(site.state.builds).toBe(0);
		await vi.advanceTimersByTimeAsync(600);
		await settle();
		expect(site.state.builds).toBe(1);
		await vi.advanceTimersByTimeAsync(10_000);
		expect(site.state.builds).toBe(1);
	});

	it("builds exactly once more when pages change during a build, however many times", async () => {
		const site = fakeSite([row("install")]);
		const index = createSiteSearchIndex({ models: site.models, random: () => 0 });
		const release = site.holdBuilds();

		index.schedule({ siteId: SITE_A });
		await vi.advanceTimersByTimeAsync(1500);
		await settle();
		expect(site.state.builds).toBe(1);

		for (let save = 0; save < 9; save += 1) {
			site.save("id-install");
			index.schedule({ siteId: SITE_A });
			await vi.advanceTimersByTimeAsync(100);
		}
		expect(site.state.builds).toBe(1);

		release();
		await settle();
		await vi.advanceTimersByTimeAsync(1500);
		await settle();
		expect(site.state.builds).toBe(2);
		await vi.advanceTimersByTimeAsync(10_000);
		expect(site.state.builds).toBe(2);
	});

	it("ten saves in a row cause at most two builds, however they fall around a build", async () => {
		const site = fakeSite([row("install")]);
		const index = createSiteSearchIndex({ models: site.models, random: () => 0 });
		const release = site.holdBuilds();

		site.save("id-install");
		index.schedule({ siteId: SITE_A });
		await vi.advanceTimersByTimeAsync(1500);
		await settle();
		for (let save = 0; save < 9; save += 1) {
			site.save("id-install");
			index.schedule({ siteId: SITE_A });
		}
		release();
		await settle();
		await vi.advanceTimersByTimeAsync(20_000);
		await settle();

		expect(site.state.builds).toBeLessThanOrEqual(2);
		expect(site.state.mostRunning).toBe(1);
	});

	it("never runs two builds of one site at once, even when a visitor asks while one is running", async () => {
		const site = fakeSite([row("install")]);
		const index = createSiteSearchIndex({ models: site.models, random: () => 0 });
		const release = site.holdBuilds();

		index.schedule({ siteId: SITE_A });
		await vi.advanceTimersByTimeAsync(1500);
		await settle();
		const { fingerprint } = await index.readStamp({ siteId: SITE_A });
		const visitors = [index.read({ siteId: SITE_A, fingerprint }), index.read({ siteId: SITE_A, fingerprint })];
		await settle();
		release();
		const [first, second] = await Promise.all(visitors);

		expect(first).toBe(second);
		expect(site.state.builds).toBe(1);
		expect(site.state.mostRunning).toBe(1);
	});

	it("keeps sites apart", async () => {
		const site = fakeSite([row("install"), row("install", { id: "id-install-b", siteId: SITE_B })]);
		const index = createSiteSearchIndex({ models: site.models, random: () => 0 });
		index.schedule({ siteId: SITE_A });
		index.schedule({ siteId: SITE_B });
		await vi.advanceTimersByTimeAsync(1500);
		await settle();
		expect(site.state.builds).toBe(2);
	});

	it("a build that later reads is already current: no second build for the same pages", async () => {
		const site = fakeSite([row("install")]);
		const index = createSiteSearchIndex({ models: site.models, random: () => 0 });
		index.schedule({ siteId: SITE_A });
		await vi.advanceTimersByTimeAsync(1500);
		await settle();
		const { fingerprint } = await index.readStamp({ siteId: SITE_A });
		await index.read({ siteId: SITE_A, fingerprint });
		await index.read({ siteId: SITE_A, fingerprint });
		expect(site.state.builds).toBe(1);
	});

	it("a visitor who needs the index sooner builds it now and the waiting rebuild is dropped", async () => {
		const site = fakeSite([row("install")]);
		const index = createSiteSearchIndex({ models: site.models, random: () => 0 });
		site.save("id-install");
		index.schedule({ siteId: SITE_A });
		const { fingerprint } = await index.readStamp({ siteId: SITE_A });
		await index.read({ siteId: SITE_A, fingerprint });
		expect(site.state.builds).toBe(1);
		await vi.advanceTimersByTimeAsync(10_000);
		await settle();
		expect(site.state.builds).toBe(1);
	});
});

describe("when a build fails", () => {
	it("is logged with the site and the cause, and the next change still rebuilds", async () => {
		const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const site = fakeSite([row("install")]);
		const index = createSiteSearchIndex({ models: site.models, random: () => 0 });
		site.state.failNext = true;

		index.schedule({ siteId: SITE_A });
		await vi.advanceTimersByTimeAsync(1500);
		await settle();

		expect(logged).toHaveBeenCalledWith(
			expect.objectContaining({
				atFunction: "siteSearchIndex.rebuild",
				data: expect.objectContaining({ siteId: SITE_A, error: expect.objectContaining({ message: "the database went away" }) }),
			}),
		);

		site.save("id-install");
		index.schedule({ siteId: SITE_A });
		await vi.advanceTimersByTimeAsync(1500);
		await settle();
		expect(site.state.builds).toBe(2);
		const { fingerprint } = await index.readStamp({ siteId: SITE_A });
		expect((await index.read({ siteId: SITE_A, fingerprint })).fingerprint).toBe(fingerprint);
		expect(site.state.builds).toBe(2);
	});

	it("leaves out one page that cannot be read, says which, and still builds the rest", async () => {
		const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const broken = row("broken", { blocks: [{ id: "x", name: "core/paragraph", type: "block", parentId: null, get content(): never { throw new Error("cannot read this block"); } } as unknown as BlockConfig] });
		const site = fakeSite([row("install"), broken]);
		const index = createSiteSearchIndex({ models: site.models });
		const { fingerprint } = await index.readStamp({ siteId: SITE_A });

		const built = await index.read({ siteId: SITE_A, fingerprint });

		const payload = JSON.parse(built.body) as { index: { documentCount: number } };
		expect(payload.index.documentCount).toBeGreaterThan(0);
		expect(built.body).toContain("/install");
		expect(built.body).not.toContain("/broken");
		expect(logged).toHaveBeenCalledWith(
			expect.objectContaining({
				atFunction: "siteSearchIndex.build",
				data: expect.objectContaining({ siteId: SITE_A, pageId: "id-broken", error: expect.objectContaining({ message: "cannot read this block" }) }),
			}),
		);
	});
});

describe("one index per model layer", () => {
	it("hands the same index to every caller using the same models, and a separate one to another", () => {
		const first = fakeSite([row("install")]);
		const second = fakeSite([row("install")]);
		expect(siteSearchIndexOf({ models: first.models })).toBe(siteSearchIndexOf({ models: first.models }));
		expect(siteSearchIndexOf({ models: first.models })).not.toBe(siteSearchIndexOf({ models: second.models }));
	});

	it("scheduleSearchIndexRebuild reaches that index and builds a moment later", async () => {
		const site = fakeSite([row("install")]);
		scheduleSearchIndexRebuild({ models: site.models, siteId: SITE_A });
		expect(site.state.builds).toBe(0);
		await vi.advanceTimersByTimeAsync(2000);
		await settle();
		expect(site.state.builds).toBe(1);
	});
});
