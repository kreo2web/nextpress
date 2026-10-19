/**
 * An import file must not be able to write a site's AI settings. Everything the test asserts on is built
 * here from the transfer fixtures (in-memory database), so nothing depends on stored data.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { createTransferExporter } from "../transfer/export-data";
import { createTransferImporter } from "../transfer/import-data";
import { validateExportFile } from "../transfer/manifest";
import { buildTestModels, IDS, seedFixture, wipeAll } from "../transfer/test-fixtures";
import type { ExportFile } from "../transfer/types";

const models = buildTestModels();
const logLines: string[] = [];
const exporter = createTransferExporter({ models, appVersion: "1.0.0-test", log: () => {} });
const importer = createTransferImporter({ models, log: (message) => logLines.push(message) });

const RESERVED_IDS = {
	aiSettings: "18181818-1818-4181-8181-181818181818",
	aiHistory: "19191919-1919-4191-8191-191919191919",
};
const T0 = new Date("2026-01-01T00:00:00.000Z");

const roundTrip = (file: ExportFile): ExportFile => validateExportFile(JSON.parse(JSON.stringify(file)));

/** A normal export with two hand-made `ai_builder*` rows added, as an attacker's file would carry. */
const buildFileWithReservedRows = async (): Promise<ExportFile> => {
	const file = await exporter.exportData({});
	const homepage = file.data.options?.[0];
	if (!homepage) throw new Error("the fixture should have an option row");
	file.data.options = [
		...(file.data.options ?? []),
		{ ...homepage, id: RESERVED_IDS.aiSettings, name: "ai_builder", value: '{"provider":"openai-compatible","baseUrl":"http://169.254.169.254/"}' },
		{ ...homepage, id: RESERVED_IDS.aiHistory, name: "AI_Builder_History", value: "from the file" },
	];
	return roundTrip(file);
};

beforeEach(async () => {
	logLines.length = 0;
	await wipeAll();
	await seedFixture(models);
});

describe("importing options", () => {
	it("skips AI settings rows, counts them as skipped and says which ones in the log", async () => {
		const file = await buildFileWithReservedRows();
		await wipeAll();

		const summary = await importer.importData({ exportFile: file, mode: "overwrite" });

		expect(summary.options).toEqual({ created: 2, updated: 0, skipped: 2, errors: [] });
		expect(await models.options.findById(RESERVED_IDS.aiSettings)).toBeUndefined();
		expect(await models.options.findById(RESERVED_IDS.aiHistory)).toBeUndefined();
		expect((await models.options.findMany({ limit: 100 })).map((option) => option.name)).toEqual(
			expect.arrayContaining(["homepage_page_slug"]),
		);
		const skipLog = logLines.find((line) => line.includes("reserved option row"));
		expect(skipLog).toContain(RESERVED_IDS.aiSettings);
		expect(skipLog).toContain("ai_builder");
		expect(skipLog).toContain(IDS.siteA);
	});

	it("leaves settings already saved on the site as they were, even in overwrite mode", async () => {
		await models.options.create({
			id: RESERVED_IDS.aiSettings,
			siteId: IDS.siteA,
			name: "ai_builder",
			value: "the settings the admin saved",
			other: {},
			createdAt: T0,
			updatedAt: T0,
		});
		const file = await buildFileWithReservedRows();

		await importer.importData({ exportFile: file, mode: "overwrite" });

		expect((await models.options.findById(RESERVED_IDS.aiSettings))?.value).toBe("the settings the admin saved");
		expect(await models.options.findById(RESERVED_IDS.aiHistory)).toBeUndefined();
	});

	it("still imports ordinary options", async () => {
		const file = await buildFileWithReservedRows();
		await models.options.update(IDS.optionA1, { value: "changed after the export" });

		const summary = await importer.importData({ exportFile: file, mode: "overwrite" });

		expect(summary.options?.updated).toBe(2);
		expect((await models.options.findById(IDS.optionA1))?.value).toBe("home");
	});
});
