import { z } from "zod";
import { defineTool } from "./tool-helpers.js";
import type { MediaSummary, PageTool, PageToolContext, SiteLookups } from "./types.js";

const DEFAULT_MEDIA_LIMIT = 20;
const MAX_MEDIA_LIMIT = 50;

const describeMedia = (media: MediaSummary): string => {
	const size = media.width && media.height ? ` ${media.width}x${media.height}` : "";
	const alt = media.alt ? ` alt=${JSON.stringify(media.alt)}` : "";
	const name = media.name ? ` name=${JSON.stringify(media.name)}` : "";
	const type = media.mimeType ? ` ${media.mimeType}` : "";
	return `- url=${media.url}${name}${alt}${size}${type} id=${media.id}`;
};

const createListMediaTool = ({ ctx, listMedia }: { ctx: PageToolContext; listMedia: NonNullable<SiteLookups["listMedia"]> }): PageTool =>
	defineTool({
		ctx,
		definition: {
			name: "list_media",
			title: "Media library",
			description:
				"Searches the site's media library for pictures and files. Returns each file's url (use it as an image block's url), name, alt text and size. Look here before using any picture. Never use pictures from other websites. If nothing fits, use /placeholder.png and tell the person. Returns up to 50 files.",
			inputShape: {
				search: z.string().max(100).optional().describe("Words from the file name or alt text."),
				limit: z.number().int().min(1).max(MAX_MEDIA_LIMIT).optional().describe(`How many files to return. Default ${DEFAULT_MEDIA_LIMIT}.`),
			},
			changesPage: false,
			run: async ({ search, limit }) => {
				const files = await listMedia({ search, limit: limit ?? DEFAULT_MEDIA_LIMIT });
				if (files.length === 0) {
					return { ok: true, text: "No media found. Use /placeholder.png for pictures and tell the person to add their own." };
				}
				return { ok: true, text: [`${files.length} file${files.length === 1 ? "" : "s"}:`, ...files.map(describeMedia)].join("\n") };
			},
		},
	});

const createListPagesTool = ({ ctx, listPages }: { ctx: PageToolContext; listPages: NonNullable<SiteLookups["listPages"]> }): PageTool =>
	defineTool({
		ctx,
		definition: {
			name: "list_pages",
			title: "Site pages",
			description:
				"Lists the pages on this site with title, address and status. Use it before you add a link, and link only to addresses in this list. If the page a link needs does not exist, say so instead of inventing an address.",
			inputShape: {},
			changesPage: false,
			run: async () => {
				const pages = await listPages();
				if (pages.length === 0) return { ok: true, text: "The site has no pages yet." };
				return {
					ok: true,
					text: pages.map((page) => `- ${JSON.stringify(page.title)} link=/${(page.path ?? page.slug).replace(/^\//, "")} status=${page.status} id=${page.id}`).join("\n"),
				};
			},
		},
	});

const createListPartsTool = ({ ctx, listTemplateParts }: { ctx: PageToolContext; listTemplateParts: NonNullable<SiteLookups["listTemplateParts"]> }): PageTool =>
	defineTool({
		ctx,
		definition: {
			name: "list_template_parts",
			title: "Template parts",
			description:
				'Lists the site\'s shared template parts (a header or footer used on many pages). To use one on the page, insert a core/template-part block with content {"templateId": "<id>"} instead of building the same thing again.',
			inputShape: {},
			changesPage: false,
			run: async () => {
				const parts = await listTemplateParts();
				if (parts.length === 0) return { ok: true, text: "The site has no template parts." };
				return { ok: true, text: parts.map((part) => `- ${JSON.stringify(part.name)} root=${part.rootBlock} id=${part.id}`).join("\n") };
			},
		},
	});

const createGetThemeTool = ({ ctx, getTheme }: { ctx: PageToolContext; getTheme: NonNullable<SiteLookups["getTheme"]> }): PageTool =>
	defineTool({
		ctx,
		definition: {
			name: "get_theme",
			title: "Site theme",
			description:
				"Returns the site theme: its name, colours, fonts and corner radius. Use it to choose colours that fit the site. In styles, prefer the theme variables listed in get_design_guide (var(--npb-accent) and so on) over fixed colour values.",
			inputShape: {},
			changesPage: false,
			run: async () => {
				const theme = await getTheme();
				const colors = Object.entries(theme.colors).map(([name, value]) => `- ${name}: ${value}`);
				return {
					ok: true,
					text: [
						`Theme: ${theme.name}`,
						"Colours:",
						...(colors.length > 0 ? colors : ["- none set"]),
						theme.fonts?.heading ? `Heading font: ${theme.fonts.heading}` : "",
						theme.fonts?.body ? `Body font: ${theme.fonts.body}` : "",
						theme.radius ? `Corner radius: ${theme.radius}` : "",
					]
						.filter(Boolean)
						.join("\n"),
				};
			},
		},
	});

/** The site lookups the host provided. A tool whose lookup is missing is left out. */
export const createSiteTools = (ctx: PageToolContext): PageTool[] => {
	const { listMedia, listPages, listTemplateParts, getTheme } = ctx.site ?? {};
	return [
		...(listMedia ? [createListMediaTool({ ctx, listMedia })] : []),
		...(listPages ? [createListPagesTool({ ctx, listPages })] : []),
		...(listTemplateParts ? [createListPartsTool({ ctx, listTemplateParts })] : []),
		...(getTheme ? [createGetThemeTool({ ctx, getTheme })] : []),
	];
};
