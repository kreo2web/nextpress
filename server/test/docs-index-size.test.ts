import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import type { BlockConfig } from "@shared/schema-types";
import { buildSearchIndexPayload } from "../lib/site-search";

/** A small repeatable random source, so the fixture is the same on every run. */
const seeded = (seed: number) => () => {
	seed = (seed * 1664525 + 1013904223) % 4294967296;
	return seed / 4294967296;
};

const syllables = ["ka", "lo", "mi", "ra", "ten", "su", "pol", "vi", "dex", "an", "or", "bel", "ci", "mar", "tu", "ney", "fro", "gli", "han", "jo"];
const makeWord = (rank: number): string => {
	let n = rank + 1;
	let word = "";
	while (n > 0) {
		word += syllables[n % syllables.length];
		n = Math.floor(n / syllables.length);
	}
	return word;
};
/** About 8,000 different words, common ones used far more often, as in real writing. */
const VOCABULARY = Array.from({ length: 8000 }, (_, rank) => makeWord(rank));

const makePages = ({ count, wordsPerPage }: { count: number; wordsPerPage: number }) => {
	const random = seeded(7);
	const pick = () => VOCABULARY[Math.floor(VOCABULARY.length * random() ** 2.2)];
	return Array.from({ length: count }, (_, number) => {
		const blocks: BlockConfig[] = [];
		for (let section = 0; section < 6; section += 1) {
			blocks.push({ id: `h${number}-${section}`, name: "core/heading", type: "block", parentId: null, content: { kind: "text", value: `${pick()} ${pick()} ${pick()}`, level: 2 } } as BlockConfig);
			const words = Array.from({ length: Math.round(wordsPerPage / 6) }, pick).join(" ");
			blocks.push({ id: `p${number}-${section}`, name: "core/paragraph", type: "block", parentId: null, content: { kind: "text", value: words } } as BlockConfig);
		}
		return { id: `page-${number}`, title: `Page ${pick()} ${pick()}`, path: `guides/page-${number}`, blocks };
	});
};

describe("how big the downloaded index is", () => {
	it("stays under 2 MB gzipped for 300 pages of about 1,500 words", async () => {
		const { payload, skipped } = await buildSearchIndexPayload({ pages: makePages({ count: 300, wordsPerPage: 1500 }), builtAt: new Date() });
		const raw = Buffer.from(JSON.stringify(payload));
		const gzipped = gzipSync(raw);
		console.info(`docs index, 300 pages x ~1500 words: ${raw.length} bytes raw, ${gzipped.length} bytes gzipped, ${payload.index.documentCount} entries`);
		expect(skipped).toEqual([]);
		expect(gzipped.length).toBeLessThan(2 * 1024 * 1024);
	}, 120_000);
});
