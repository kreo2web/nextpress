import { readBlogPostLook } from "@shared/blog/blog-post-look";
import { composeBlogPost, isWrittenPost } from "@shared/blog/compose-blog-post";
import type { JsonValue } from "@shared/blocks/docs-types";
import type { BlockConfig } from "@shared/schema-types";
import type { Deps } from "../routes/shared/deps";

type BlogModels = Pick<Deps["models"], "blogs">;

/**
 * A written post's blocks as visitors see them: its body inside its blog's look. Any other document
 * comes back as it is. `lookStamp` changes when the look does, so a cached page can't outlive it.
 */
export async function composeWrittenPost({ models, blogId, blocks }: { models: BlogModels; blogId: string | null | undefined; blocks: BlockConfig[] }): Promise<{ blocks: BlockConfig[]; lookStamp: string }> {
	if (!isWrittenPost(blocks)) return { blocks, lookStamp: "" };
	const blog = blogId ? await models.blogs.findById(blogId) : null;
	if (!blog) console.warn({ atFunction: "composeWrittenPost", data: { blogId }, message: "A written post's blog was not found; it is shown in the default look" });
	// jsonb holds JSON; the reader checks every field it uses.
	const look = readBlogPostLook((blog?.settings ?? undefined) as JsonValue | undefined);
	return { blocks: composeBlogPost({ body: blocks[0], look }), lookStamp: JSON.stringify(look) };
}
