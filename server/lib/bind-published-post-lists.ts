import type { Filter, FindManyOptions } from "@shared/create-models";
import type { BlockConfig, Post } from "@shared/schema-types";
import { documentHasBlockName } from "@shared/bind-post-blocks";
import {
	bindPostListBlock,
	type BoundPostListItem,
	readListPage,
	readPostListContent,
	type PostListMore,
} from "@shared/bind-post-list";
import { attachPostAuthor } from "./attach-post-author";
import { toModelOrderBy } from "@shared/content-list-query";
import { enrichPostForApi, postHasCategory } from "@shared/posts/post-other";

type PostRow = {
	id: string;
	title?: string | null;
	slug?: string | null;
	excerpt?: string | null;
	featuredImage?: string | null;
	publishedAt?: string | Date | null;
	createdAt?: string | Date | null;
	status?: string | null;
	blogId?: string | null;
	authorId?: string | null;
	other?: unknown;
};

type BindModels = {
	users: { findById: (id: string) => Promise<unknown> };
	blogs: {
		findManyWhere: (where: Filter[], options?: FindManyOptions) => Promise<Array<{ id: string }>>;
	};
	posts: {
		findManyWhere: (where: Filter[], options?: FindManyOptions) => Promise<PostRow[]>;
		count: (args: { where: Filter[] }) => Promise<number>;
	};
};

const toIso = (value: string | Date | null | undefined): string => {
	if (!value) return "";
	if (value instanceof Date) return value.toISOString();
	return String(value);
};

/**
 * Fill post/list blocks with published posts for this site so SSR HTML
 * matches the public SPA (no dummy "Post Title 1" cards).
 */
export async function bindPublishedPostLists({
	models,
	siteId,
	blocks,
	listPage,
	timeZone,
}: {
	models: BindModels;
	siteId: string;
	blocks: BlockConfig[];
	listPage?: number;
	/** The site's timezone, so list dates match the rest of the site. */
	timeZone?: string;
}): Promise<BlockConfig[]> {
	if (!documentHasBlockName({ blocks, name: "post/list" })) return blocks;

	const blogs = await models.blogs.findManyWhere([{ where: "siteId", equals: siteId }]);
	const siteBlogIds = blogs.map((blog) => blog.id);
	return walk({ models, siteBlogIds, blocks, listPage: readListPage(listPage), timeZone });
}

async function walk({
	models,
	siteBlogIds,
	blocks,
	listPage,
	timeZone,
}: {
	models: BindModels;
	siteBlogIds: string[];
	blocks: BlockConfig[];
	listPage: number;
	timeZone?: string;
}): Promise<BlockConfig[]> {
	const next: BlockConfig[] = [];
	for (const block of blocks) {
		const children = Array.isArray(block.children)
			? await walk({ models, siteBlogIds, blocks: block.children, listPage, timeZone })
			: block.children;
		let current = children === block.children ? block : { ...block, children };
		if (current.name === "post/list") {
			const content = readPostListContent(current.content);
			const page = content.morePosts === "pages" ? listPage : 1;
			const loaded = await loadPublishedListItems({
				models,
				siteBlogIds,
				blogId: content.blogId,
				category: content.category,
				limit: content.postsPerPage,
				offset: (page - 1) * content.postsPerPage,
				orderBy: content.orderBy,
				order: content.order,
				morePosts: content.morePosts,
			});
			current = bindPostListBlock({
				block: current,
				posts: loaded.items,
				page,
				hasMore: loaded.hasMore,
				totalPages: loaded.totalPages,
				timeZone,
			});
		}
		next.push(current);
	}
	return next;
}

async function loadPublishedListItems({
	models,
	siteBlogIds,
	blogId,
	category,
	limit,
	offset,
	orderBy,
	order,
	morePosts,
}: {
	models: BindModels;
	siteBlogIds: string[];
	blogId: string;
	category: string;
	limit: number;
	offset: number;
	orderBy: string;
	order: string;
	morePosts: PostListMore;
}): Promise<{ items: BoundPostListItem[]; hasMore: boolean; totalPages: number }> {
	const allowed = blogId ? (siteBlogIds.includes(blogId) ? [blogId] : []) : siteBlogIds;
	if (allowed.length === 0) return { items: [], hasMore: false, totalPages: 1 };

	const sortField = orderBy === "title" ? "title" : "createdAt";
	const fetchWide = Boolean(category.trim());
	const needExtra = morePosts !== "none";
	const fetchLimit = fetchWide
		? Math.min(500, Math.max((offset + limit) * 8, 80))
		: needExtra
			? limit + 1
			: limit;
	const filters: Filter[] = [
		{ where: "status", equals: "publish" },
		{ where: "blogId", in: allowed },
	];
	const rows = await models.posts.findManyWhere(filters, {
		limit: fetchLimit,
		offset: fetchWide ? 0 : offset,
		orderBy: toModelOrderBy({
			sort: sortField,
			order: order === "asc" ? "asc" : "desc",
		}),
	});

	const mapped: BoundPostListItem[] = [];
	for (const row of rows) {
		const enriched = enrichPostForApi(row as Post);
		if (!postHasCategory(enriched, category)) continue;
		const withAuthor = await attachPostAuthor({ models, post: enriched });
		mapped.push({
			id: row.id,
			title: row.title?.trim() || "Untitled",
			slug: row.slug || row.id,
			excerpt: row.excerpt ?? "",
			featuredImage: typeof row.featuredImage === "string" ? row.featuredImage : "",
			publishedAt: toIso(row.publishedAt ?? row.createdAt),
			authorName: withAuthor.author?.name ?? "",
		});
	}

	const windowed = fetchWide ? mapped.slice(offset, offset + limit) : mapped.slice(0, limit);
	const hasMore = fetchWide ? offset + windowed.length < mapped.length : mapped.length > limit;
	const total = fetchWide
		? mapped.length
		: morePosts === "pages"
			? await models.posts.count({ where: filters })
			: offset + windowed.length + (hasMore ? 1 : 0);
	const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
	return { items: windowed, hasMore, totalPages };
}
