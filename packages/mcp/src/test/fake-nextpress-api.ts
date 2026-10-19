import type { BlockConfig } from "@nextpress-org/sdk";

/**
 * A NextPress server held in memory, reached through `fetch`, so tests exercise the real SDK
 * client and the real MCP tools and mock only the HTTP edge. It keeps the rules the tests
 * depend on: saves need the current version, a stale version answers 409 VERSION_STALE, every
 * save bumps the version and keeps the old blocks in the history.
 */

export const SITE_ID = "00000000-0000-4000-8000-000000000001";
export const PAGE_ID = "00000000-0000-4000-8000-000000000004";
export const POST_ID = "00000000-0000-4000-8000-000000000005";
export const PART_ID = "00000000-0000-4000-8000-000000000006";

type HistoryEntry = { version: number; updatedAt: string; blocks: BlockConfig[]; authorId?: string };

export type FakeEntity = {
	id: string;
	title: string;
	slug: string;
	status: string;
	siteId: string;
	version: number;
	blocks: BlockConfig[];
	history: HistoryEntry[];
};

export type FakeRequest = { method: string; path: string; query: URLSearchParams; body: Record<string, unknown> };

type FakeRoute = {
	method: string;
	pattern: RegExp;
	handle: (params: { match: RegExpMatchArray; request: FakeRequest }) => Response;
};

export type FakeApi = {
	fetch: typeof fetch;
	requests: FakeRequest[];
	pages: Map<string, FakeEntity>;
	posts: Map<string, FakeEntity>;
	/** Rows the template-part, form and media routes answer with. */
	templateParts: Array<Record<string, unknown>>;
	partUsage: Map<string, Array<Record<string, unknown>>>;
	submissions: Array<Record<string, unknown>>;
	/** Runs once, right before the next save, to play a save made somewhere else (the owner in the dashboard). */
	beforeNextSave: ((entity: FakeEntity) => void) | undefined;
	/** Makes the next save fail the way a server error would. */
	failNextSave: { status: number; message: string } | undefined;
};

export const makeEntity = ({
	id,
	slug,
	title,
	blocks,
	version = 0,
	history = [],
}: {
	id: string;
	slug: string;
	title: string;
	blocks: BlockConfig[];
	version?: number;
	history?: HistoryEntry[];
}): FakeEntity => ({ id, title, slug, status: "draft", siteId: SITE_ID, version, blocks, history });

const json = (body: object, status = 200): Response => Response.json(body, { status });

const toApiEntity = ({ history: _history, ...entity }: FakeEntity): object => entity;

const listEnvelope = <K extends string>({ key, rows }: { key: K; rows: object[] }): object => ({
	[key]: rows,
	total: rows.length,
	page: 1,
	per_page: 100,
	total_pages: 1,
});

const parseBody = (init: RequestInit | undefined): Record<string, unknown> => {
	if (typeof init?.body !== "string") return {};
	return JSON.parse(init.body) as Record<string, unknown>;
};

const createEntityRoutes = ({ kind, store, api }: { kind: "pages" | "posts"; store: Map<string, FakeEntity>; api: FakeApi }): FakeRoute[] => [
	{
		method: "GET",
		pattern: new RegExp(`^/api/${kind}$`),
		handle: () => json(listEnvelope({ key: kind, rows: [...store.values()].map(toApiEntity) })),
	},
	{
		method: "GET",
		pattern: new RegExp(`^/api/${kind}/([^/]+)$`),
		handle: ({ match }) => {
			const key = decodeURIComponent(match[1] ?? "");
			const entity = store.get(key) ?? [...store.values()].find((candidate) => candidate.slug === key);
			return entity ? json(toApiEntity(entity)) : json({ message: "Not found" }, 404);
		},
	},
	{
		method: "PUT",
		pattern: new RegExp(`^/api/${kind}/([^/]+)$`),
		handle: ({ match, request }) => {
			const entity = store.get(match[1] ?? "");
			if (!entity) return json({ message: "Not found" }, 404);
			if (api.failNextSave) {
				const { status, message } = api.failNextSave;
				api.failNextSave = undefined;
				return json({ message }, status);
			}
			const hook = api.beforeNextSave;
			api.beforeNextSave = undefined;
			hook?.(entity);
			if (request.body.expectedVersion !== entity.version) {
				return json(
					{
						code: "VERSION_STALE",
						message: `Remote version ${entity.version} does not match expected ${String(request.body.expectedVersion)}. Fetch latest and retry.`,
						remoteVersion: entity.version,
						expectedVersion: request.body.expectedVersion,
					},
					409,
				);
			}
			if (Array.isArray(request.body.blocks)) {
				entity.history.unshift({ version: entity.version, updatedAt: "2026-10-17T10:00:00.000Z", blocks: entity.blocks });
				entity.blocks = request.body.blocks as BlockConfig[];
			}
			if (typeof request.body.title === "string") entity.title = request.body.title;
			entity.version += 1;
			return json(toApiEntity(entity));
		},
	},
];

const createHistoryRoutes = (store: Map<string, FakeEntity>): FakeRoute[] => [
	{
		method: "GET",
		pattern: /^\/api\/pages\/([^/]+)\/history$/,
		handle: ({ match }) => {
			const entity = store.get(match[1] ?? "");
			if (!entity) return json({ message: "Page not found" }, 404);
			return json({ pageId: entity.id, currentVersion: entity.version, history: entity.history });
		},
	},
	{
		method: "POST",
		pattern: /^\/api\/pages\/([^/]+)\/restore$/,
		handle: ({ match, request }) => {
			const entity = store.get(match[1] ?? "");
			if (!entity) return json({ message: "Page not found" }, 404);
			const snapshot = entity.history.find((entry) => entry.version === request.body.version);
			if (!snapshot) return json({ message: "Version not found in history" }, 404);
			entity.history.unshift({ version: entity.version, updatedAt: "2026-10-17T11:00:00.000Z", blocks: entity.blocks });
			entity.blocks = snapshot.blocks;
			entity.version += 1;
			return json(toApiEntity(entity));
		},
	},
];

/** Builds the fake server. Pass the pages and posts the test starts with. */
export const createFakeApi = ({ pages = [], posts = [] }: { pages?: FakeEntity[]; posts?: FakeEntity[] } = {}): FakeApi => {
	const api: FakeApi = {
		fetch: ((input: string | URL | Request, init?: RequestInit) => respond(input, init)) as typeof fetch,
		requests: [],
		pages: new Map(pages.map((entity) => [entity.id, entity])),
		posts: new Map(posts.map((entity) => [entity.id, entity])),
		templateParts: [],
		partUsage: new Map(),
		submissions: [],
		beforeNextSave: undefined,
		failNextSave: undefined,
	};

	const routes: FakeRoute[] = [
		...createEntityRoutes({ kind: "pages", store: api.pages, api }),
		...createEntityRoutes({ kind: "posts", store: api.posts, api }),
		...createHistoryRoutes(api.pages),
		{
			method: "GET",
			pattern: /^\/api\/templates$/,
			handle: () => json(listEnvelope({ key: "templates", rows: api.templateParts })),
		},
		{
			method: "POST",
			pattern: /^\/api\/templates$/,
			handle: ({ request }) => {
				const part = { id: PART_ID, type: "part", name: request.body.name, blocks: request.body.blocks };
				api.templateParts.push({ ...part, usedOnPages: 0 });
				return json(part, 201);
			},
		},
		{
			method: "GET",
			pattern: /^\/api\/templates\/([^/]+)\/usage$/,
			handle: ({ match }) => json({ pages: api.partUsage.get(match[1] ?? "") ?? [] }),
		},
		{
			method: "GET",
			pattern: /^\/api\/forms\/submissions$/,
			handle: () =>
				json({
					items: api.submissions,
					total: api.submissions.length,
					formNames: ["Contact"],
					unread: api.submissions.length,
					page: 1,
					perPage: 20,
					pageTitles: {},
				}),
		},
		{
			method: "POST",
			pattern: /^\/api\/media\/svgl$/,
			handle: ({ request }) =>
				json(
					{
						id: "00000000-0000-4000-8000-000000000007",
						filename: "github.svg",
						originalName: "github.svg",
						mimeType: "image/svg+xml",
						size: 100,
						url: "/uploads/github.svg",
						alt: request.body.title ?? null,
					},
					201,
				),
		},
	];

	const respond = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
		const url = new URL(String(input));
		const request: FakeRequest = {
			method: init?.method ?? "GET",
			path: url.pathname,
			query: url.searchParams,
			body: parseBody(init),
		};
		api.requests.push(request);
		for (const route of routes) {
			const match = url.pathname.match(route.pattern);
			if (match && route.method === request.method) return route.handle({ match, request });
		}
		return json({ message: `No fake route for ${request.method} ${url.pathname}` }, 404);
	};

	return api;
};
