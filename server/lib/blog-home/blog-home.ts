import { readBlogHomeList, type BlogHome, type BlogHomeList } from "@shared/blog/blog-home-list";
import type { JsonValue } from "@shared/blocks/docs-types";
import type { BlockConfig } from "@shared/schema-types";
import type { Deps } from "../../routes/shared/deps";
import { pathOfPage } from "../page-paths/page-paths";
import { savePageVersion } from "../save-page-version";

type BlogRow = { id: string; pageId?: string | null };

/** The post list on the blog's page that lists this blog (the one made with the blog), or the first post list. */
function findBlogList({ blocks, blogId }: { blocks: BlockConfig[]; blogId: string }): BlockConfig | null {
	const lists: BlockConfig[] = [];
	const walk = (items: BlockConfig[]): void =>
		items.forEach((block) => {
			if (block.name === "post/list") lists.push(block);
			walk(block.children ?? []);
		});
	walk(blocks);
	// The list's fields are stored plain (no `kind`), as the block saves them.
	const fieldsOf = (block: BlockConfig): JsonValue | undefined => block.content as JsonValue | undefined;
	return lists.find((block) => {
		const fields = fieldsOf(block);
		return typeof fields === "object" && fields !== null && !Array.isArray(fields) && fields.blogId === blogId;
	}) ?? lists[0] ?? null;
}

/** The blog's home page and how it lists posts; null when the blog has no page (made before pages were made with blogs). */
export async function readBlogHome({ models, blog }: { models: Deps["models"]; blog: BlogRow }): Promise<BlogHome | null> {
	if (!blog.pageId) return null;
	const page = await models.pages.findById(blog.pageId);
	if (!page) return null;
	const blocks = (Array.isArray(page.blocks) ? page.blocks : []) as BlockConfig[];
	const list = findBlogList({ blocks, blogId: blog.id });
	return {
		pageId: page.id,
		address: `/${await pathOfPage({ models, page })}`,
		status: String(page.status ?? "draft"),
		list: readBlogHomeList(list ? (list.content as JsonValue | undefined) : undefined),
	};
}

/** Changes how the blog's home lists posts, saved the one way every page save goes. */
export async function updateBlogHomeList({ models, hooks, blog, list }: { models: Deps["models"]; hooks: Deps["hooks"]; blog: BlogRow; list: Partial<BlogHomeList> }): Promise<BlogHome | null> {
	if (!blog.pageId) return null;
	const page = await models.pages.findById(blog.pageId);
	if (!page) return null;
	const blocks = (Array.isArray(page.blocks) ? page.blocks : []) as BlockConfig[];
	const target = findBlogList({ blocks, blogId: blog.id });
	if (!target) return readBlogHome({ models, blog });
	const replace = (items: BlockConfig[]): BlockConfig[] =>
		items.map((block) => {
			if (block.id === target.id) return { ...block, content: { ...(block.content as object), ...list } as BlockConfig["content"] };
			return block.children ? { ...block, children: replace(block.children) } : block;
		});
	await savePageVersion({ models, hooks, page, changes: { blocks: replace(blocks) }, expectedVersion: page.version ?? 0 });
	return readBlogHome({ models, blog });
}
