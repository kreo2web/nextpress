import { AI_ASSISTANT_MESSAGES, type AiChatContentType, type AiChatErrorCode } from "@shared/ai-builder";
import { canOnSite } from "../access/site-standing";
import type { Deps } from "../../routes/shared/deps";

export type PageEditModels = Pick<Deps["models"], "sites" | "roles" | "userRoles" | "pages" | "posts" | "blogs">;

export type PageEditCheck =
	| { ok: true }
	| { ok: false; status: number; code: Extract<AiChatErrorCode, "not_allowed" | "page_missing">; message: string };

const missing: PageEditCheck = { ok: false, status: 404, code: "page_missing", message: AI_ASSISTANT_MESSAGES.pageMissing };

/**
 * The person may use the assistant on this site (editor or above: it spends the site's AI key),
 * and the page or post lives on it. A page on another site answers "not found", so ids from other
 * sites can't be probed.
 */
export async function assertPageEditAccess({
	models,
	userId,
	siteId,
	pageId,
	contentType,
}: {
	models: PageEditModels;
	userId: string;
	siteId: string;
	pageId: string;
	contentType: AiChatContentType;
}): Promise<PageEditCheck> {
	if (!(await canOnSite({ models, userId, siteId, action: "use_assistant" }))) {
		return { ok: false, status: 403, code: "not_allowed", message: AI_ASSISTANT_MESSAGES.noSiteAccess };
	}

	if (contentType === "page") {
		const page = await models.pages.findById(pageId);
		return page && String(page.siteId) === siteId ? { ok: true } : missing;
	}

	const post = await models.posts.findById(pageId);
	if (!post?.blogId) return missing;
	const blog = await models.blogs.findById(String(post.blogId));
	return blog && String(blog.siteId) === siteId ? { ok: true } : missing;
}
