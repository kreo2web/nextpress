import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { readBlogPostLook, writeBlogPostLook, type BlogPostLook } from "@shared/blog/blog-post-look";
import type { JsonValue } from "@shared/blocks/docs-types";
import type { BlogHome, BlogHomeList } from "@shared/blog/blog-home-list";
import type { Blog } from "@shared/schema-types";
import { apiRequest } from "@/lib/queryClient";

const blogKey = (blogId: string) => [`/api/blogs/${blogId}`] as const;

/** A post's blog, asked for again whenever the editor opens (the look may have changed elsewhere). */
export function useBlog({ blogId }: { blogId: string }): UseQueryResult<Blog, Error> {
	return useQuery<Blog, Error>({
		queryKey: blogKey(blogId),
		enabled: blogId !== "",
		staleTime: 0,
	});
}

/** The blog's post look, read the same way the server reads it; the defaults until the blog arrives. */
export const lookOfBlog = (blog: Blog | undefined): BlogPostLook => readBlogPostLook((blog?.settings ?? undefined) as JsonValue | undefined);

/** Saves a change to the look for the whole blog. Every post shows it at once: none stores a copy. */
export function useSaveBlogLook({ blog }: { blog: Blog | undefined }) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (look: Partial<BlogPostLook>): Promise<Blog> => {
			if (!blog) throw new Error("The blog hasn't loaded yet. Try again in a moment.");
			const settings = writeBlogPostLook({ settings: (blog.settings ?? undefined) as JsonValue | undefined, look });
			const response = await apiRequest("PUT", `/api/blogs/${blog.id}`, { settings });
			return (await response.json()) as Blog;
		},
		onSuccess: (saved) => queryClient.setQueryData(blogKey(saved.id), saved),
	});
}

const homeKey = (blogId: string) => [`/api/blogs/${blogId}/home`] as const;

/** The blog's home page: where it is, whether it is live, and how it lists posts. */
export function useBlogHome({ blogId }: { blogId: string }): UseQueryResult<BlogHome, Error> {
	return useQuery<BlogHome, Error>({ queryKey: homeKey(blogId), enabled: blogId !== "", staleTime: 0 });
}

/** Changes how the blog's home lists posts. */
export function useSaveBlogHomeList({ blogId }: { blogId: string }) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (list: Partial<BlogHomeList>): Promise<BlogHome> => {
			const response = await apiRequest("PUT", `/api/blogs/${blogId}/home/list`, list);
			return (await response.json()) as BlogHome;
		},
		onSuccess: (saved) => queryClient.setQueryData(homeKey(blogId), saved),
	});
}

/** Renames the blog. */
export function useRenameBlog({ blogId }: { blogId: string }) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (name: string): Promise<Blog> => {
			const response = await apiRequest("PUT", `/api/blogs/${blogId}`, { name });
			return (await response.json()) as Blog;
		},
		onSuccess: (saved) => queryClient.setQueryData(blogKey(saved.id), saved),
	});
}
