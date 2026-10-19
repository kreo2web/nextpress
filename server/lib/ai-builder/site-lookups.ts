import { isTemplatePart, readTemplatePartSiteId } from "@shared/template-usage";
import { readTemplateRoot } from "@shared/template-parts/template-part-root";
import { parseThemeSettings } from "@shared/theme-settings";
import type { BlockConfig } from "@shared/schema-types";
import type { MediaSummary, PageSummary, SiteLookups, TemplatePartSummary, ThemeSummary } from "@shared/page-tools";
import type { Deps } from "../../routes/shared/deps";

export type SiteLookupModels = Pick<Deps["models"], "media" | "pages" | "templates" | "sites" | "themes">;

const asBlocks = (value: unknown): BlockConfig[] => (Array.isArray(value) ? (value as BlockConfig[]) : []);

const matchesSearch = ({
	file,
	search,
}: {
	file: { filename: string; originalName: string; alt: string | null };
	search: string;
}): boolean => {
	const needle = search.trim().toLowerCase();
	if (needle === "") return true;
	return [file.filename, file.originalName, file.alt ?? ""].some((field) => field.toLowerCase().includes(needle));
};

const colorsFrom = (settings: ReturnType<typeof parseThemeSettings>): Record<string, string> => {
	const colors = settings.colors ?? {};
	return Object.fromEntries(
		Object.entries(colors).flatMap(([name, value]) => (typeof value === "string" && value !== "" ? [[name, value]] : [])),
	);
};

/**
 * Read-only site facts for the page tools. Each lookup stays on this site.
 */
export const createSiteLookups = ({ models, siteId }: { models: SiteLookupModels; siteId: string }): SiteLookups => ({
	listMedia: async ({ search, limit }) => {
		const rows = await models.media.findManyWhere([{ where: "siteId", equals: siteId }]);
		const matched = rows.filter((row) => matchesSearch({ file: row, search: search ?? "" }));
		return matched.slice(0, limit).map(
			(row): MediaSummary => ({
				id: row.id,
				url: row.url,
				name: row.originalName,
				alt: row.alt ?? undefined,
				mimeType: row.mimeType,
			}),
		);
	},

	listPages: async () => {
		const rows = await models.pages.findManyWhere([{ where: "siteId", equals: siteId }]);
		return rows
			.filter((row) => row.status !== "trash")
			.map((row): PageSummary => ({ id: row.id, title: row.title, slug: row.slug, status: row.status ?? "draft" }));
	},

	listTemplateParts: async () => {
		const rows = await models.templates.findMany();
		return rows.flatMap((row): TemplatePartSummary[] => {
			if (!isTemplatePart(row.other) || readTemplatePartSiteId(row.other) !== siteId) return [];
			const root = readTemplateRoot(asBlocks(row.blocks));
			return [{ id: row.id, name: row.name, rootBlock: root?.name ?? "unknown" }];
		});
	},

	getTheme: async () => {
		const site = await models.sites.findById(siteId);
		const theme = site?.activeThemeId ? await models.themes.findById(String(site.activeThemeId)) : null;
		const settings = parseThemeSettings(theme?.settings);
		const summary: ThemeSummary = {
			name: theme?.name ?? "Default",
			colors: colorsFrom(settings),
			fonts: {
				heading: settings.typography?.title?.fontFamily,
				body: settings.typography?.body?.fontFamily,
			},
			radius: settings.shape?.radius,
		};
		return summary;
	},
});
