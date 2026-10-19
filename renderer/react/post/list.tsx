import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { getRenderProps } from "../render-helpers";
import {
	isSafePublicMediaUrl,
	postListPageHref,
	postListPublicSort,
	readPostListContent,
} from "@shared/bind-post-list";
import { formatPostListDate } from "@shared/post-info-date";


/**
 * Post List — published posts when bound; otherwise empty (no dummy titles).
 */
export function PostListBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const data = readPostListContent(block.content);
	const isGrid = data.layout === "grid" || data.layout === "cards";
	const layoutClass =
		data.layout === "list"
			? "np-post-list--list"
			: data.layout === "cards"
				? "np-post-list--cards"
				: "np-post-list--grid";
	const mergedClassName = ["wp-block-post-list", "np-post-list", layoutClass, className]
		.filter(Boolean)
		.join(" ");

	if (data.posts.length === 0) {
		return (
			<div className={mergedClassName || undefined} style={style} {...attributes}>
				<p className="np-post-list__empty" style={{ margin: 0, color: "var(--npb-text-muted)", textAlign: "center", padding: "2rem 0" }}>
					No published posts yet.
				</p>
			</div>
		);
	}

	const showMore = data.morePosts === "show-more" && data.hasMore;
	const showPages = data.morePosts === "pages" && data.totalPages > 1;

	return (
		<div
			className={mergedClassName || undefined}
			style={style}
			data-np-open={data.openIn}
			data-np-more={data.morePosts}
			data-np-page={String(data.page)}
			data-np-per-page={String(data.postsPerPage)}
			data-np-total-pages={String(data.totalPages)}
			data-np-blog={data.blogId}
			data-np-category={data.category}
			data-np-sort={postListPublicSort(data.orderBy)}
			data-np-order={data.order}
			data-np-excerpt={data.showExcerpt ? "1" : "0"}
			data-np-image={data.showFeaturedImage ? "1" : "0"}
			data-np-date={data.showDate ? "1" : "0"}
			data-np-author={data.showAuthor ? "1" : "0"}
			{...attributes}
		>
			{data.posts.map((post) => {
				const href = post.slug ? `/post/${post.slug}` : "#";
				return (
					<article key={post.slug || post.title} className="np-post-list__card">
						<a
							className="np-post-list__link"
							href={href}
							data-np-post-slug={post.slug}
							data-np-open={data.openIn}
							style={{
								textDecoration: "none",
								color: "inherit",
								display: "flex",
								flexDirection: isGrid ? "column" : "row",
								gap: isGrid ? 0 : "1rem",
							}}
						>
							{data.showFeaturedImage && post.featuredImage && isSafePublicMediaUrl(post.featuredImage) ? (
								<img className="np-post-list__image" src={post.featuredImage} alt="" />
							) : null}
							<div className="np-post-list__body">
								<strong className="np-post-list__title">{post.title}</strong>
								{data.showExcerpt && post.excerpt ? (
									<p className="np-post-list__excerpt">{post.excerpt}</p>
								) : null}
								{(data.showDate || data.showAuthor) && (post.publishedAt || post.authorName) ? (
									<small className="np-post-list__meta">
										{data.showDate && post.publishedAt ? formatPostListDate(post.publishedAt, data.timeZone ?? undefined) : null}
										{data.showDate && data.showAuthor && post.publishedAt && post.authorName ? " · " : null}
										{data.showAuthor ? post.authorName : null}
									</small>
								) : null}
							</div>
						</a>
					</article>
				);
			})}
			{showMore ? (
				<div className="np-post-list__more-wrap">
					<button type="button" className="np-post-list__more" data-np-more-btn>
						Show more
					</button>
				</div>
			) : null}
			{showPages ? (
				<nav className="np-post-list__pages" aria-label="Post list pages">
					{data.page > 1 ? (
						<a className="np-post-list__page" href={postListPageHref(data.page - 1)}>
							Previous
						</a>
					) : null}
					<span className="np-post-list__page-status">
						Page {data.page} of {data.totalPages}
					</span>
					{data.page < data.totalPages ? (
						<a className="np-post-list__page" href={postListPageHref(data.page + 1)}>
							Next
						</a>
					) : null}
				</nav>
			) : null}
		</div>
	);
}
