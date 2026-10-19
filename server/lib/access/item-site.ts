import type { Request } from "express";
import { ACCESS_MESSAGES, type SiteAccess, type SiteAction } from "@shared/access";
import type { Deps } from "../../routes/shared/deps";
import { statusError } from "../../routes/shared/status-error";
import { getRequestAuthSiteId, getRequestAuthUserId } from "../../auth";
import { assertCanOnSite } from "./assert-access";

/** Things that live on one site and are reached by their own id. */
export type SiteItemKind = "page" | "post" | "blog" | "media" | "comment";

type ItemModels = Pick<Deps["models"], "pages" | "posts" | "blogs" | "media" | "comments">;

const blogSite = async ({ models, blogId }: { models: ItemModels; blogId: string | null | undefined }): Promise<string | null> => {
	if (!blogId) return null;
	const blog = await models.blogs.findById(String(blogId));
	return blog?.siteId ? String(blog.siteId) : null;
};

const postSite = async ({ models, postId }: { models: ItemModels; postId: string | null | undefined }): Promise<string | null> => {
	if (!postId) return null;
	const post = await models.posts.findById(String(postId));
	return blogSite({ models, blogId: post?.blogId });
};

/** The site an item belongs to, or null when the item doesn't exist (or has no site). */
export async function findItemSiteId({ models, kind, id }: { models: ItemModels; kind: SiteItemKind; id: string }): Promise<string | null> {
	if (kind === "page") {
		const page = await models.pages.findById(id);
		return page?.siteId ? String(page.siteId) : null;
	}
	if (kind === "post") return postSite({ models, postId: id });
	if (kind === "blog") return blogSite({ models, blogId: id });
	if (kind === "media") {
		const item = await models.media.findById(id);
		return item?.siteId ? String(item.siteId) : null;
	}
	const comment = await models.comments.findById(id);
	return postSite({ models, postId: comment?.postId });
}

/**
 * For a request that acts on one item by id: the item must exist, an API key must belong to the
 * item's site, and the person must be allowed `action` there. A missing item and an item on a site
 * the caller can't reach both answer 404, so ids from other sites can't be probed.
 */
export async function assertCanOnItem({
	req,
	models,
	kind,
	id,
	action = "edit_content",
}: {
	req: Request;
	models: Deps["models"];
	kind: SiteItemKind;
	id: string;
	action?: SiteAction;
}): Promise<{ siteId: string; access: SiteAccess }> {
	const userId = getRequestAuthUserId(req);
	if (!userId) throw statusError({ message: ACCESS_MESSAGES.signIn, statusCode: 401 });

	const siteId = await findItemSiteId({ models, kind, id });
	const keySiteId = getRequestAuthSiteId(req);
	if (!siteId || (keySiteId && keySiteId !== siteId)) {
		throw statusError({ message: ACCESS_MESSAGES.notFound, statusCode: 404 });
	}

	const access = await assertCanOnSite({ models, userId, siteId, action }).catch((error: Error) => {
		// Someone with no standing on that site learns nothing about the item.
		if (error.message === ACCESS_MESSAGES.noSite) throw statusError({ message: ACCESS_MESSAGES.notFound, statusCode: 404 });
		throw error;
	});
	return { siteId, access };
}
