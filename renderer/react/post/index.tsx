import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { getRenderProps, parseStructuredContent, renderChildBlocks } from "../render-helpers";
import { isSafePublicMediaUrl } from "@shared/bind-post-list";
import { readBoundHeadings } from "@shared/page-headings";
import { normalizeWebsiteUrl, normalizeXProfileUrl } from "@shared/safe-http-url";
import { formatPostInfoDate, readPostInfoDateFormat } from "@shared/post-info-date";

export { PostExcerptBlock } from "./excerpt";
export { PostCommentsBlock } from "./comments";
export { PostListBlock } from "./list";

/**
 * Post Author Box — SSR placeholder.
 * Shows avatar circle, name, and bio when configured.
 */
export function PostAuthorBoxBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const data = parseStructuredContent(block.content);
	const showAvatar = data.showAvatar !== false;
	const showName = data.showName !== false;
	const showBio = data.showBio !== false;
	const isVertical = (data.layout as string) === "vertical";
	const avatarSize = (data.avatarSize as number) || 48;
	const name = typeof data.name === "string" ? data.name : "";
	const bio = typeof data.bio === "string" ? data.bio : "";
	const avatar = typeof data.avatar === "string" ? data.avatar : "";
	const websiteUrl = typeof data.websiteUrl === "string" ? normalizeWebsiteUrl(data.websiteUrl) : "";
	const xUrl = typeof data.xUrl === "string" ? normalizeXProfileUrl(data.xUrl) : "";

	const mergedClassName = ["wp-block-post-author-box", className].filter(Boolean).join(" ");
	const displayName = name || "Author";
	const displayBio = bio || "Author bio placeholder.";

	return (
		<div className={mergedClassName || undefined} style={{ display: "flex", flexDirection: isVertical ? "column" : "row", alignItems: isVertical ? "center" : "flex-start", gap: "12px", ...style }} {...attributes}>
			{showAvatar && (
				avatar ? (
					<img
						className="wp-block-post-author-box__avatar"
						src={avatar}
						alt={displayName || "Author"}
						style={{ width: avatarSize, height: avatarSize, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
					/>
				) : (
					<div className="wp-block-post-author-box__avatar" style={{ width: avatarSize, height: avatarSize, borderRadius: "50%", backgroundColor: "var(--npb-border-default)", flexShrink: 0 }} />
				)
			)}
			<div className="wp-block-post-author-box__info">
				{showName && displayName ? (
					<strong className="wp-block-post-author-box__name">{displayName}</strong>
				) : null}
				{showBio && displayBio ? (
					<p className="wp-block-post-author-box__bio" style={{ margin: "4px 0 0", color: "var(--npb-text-secondary)", fontSize: "0.875rem" }}>{displayBio}</p>
				) : null}
				{websiteUrl || xUrl ? (
					<p className="wp-block-post-author-box__links" style={{ margin: "8px 0 0", display: "flex", flexWrap: "wrap", gap: "12px", fontSize: "0.875rem" }}>
						{websiteUrl ? (
							<a href={websiteUrl} rel="noopener noreferrer">Website</a>
						) : null}
						{xUrl ? (
							<a href={xUrl} rel="noopener noreferrer">X</a>
						) : null}
					</p>
				) : null}
			</div>
		</div>
	);
}

/**
 * Post Info — SSR placeholder.
 * Shows date, categories, tags, and read time inline or stacked.
 */
export function PostInfoBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const data = parseStructuredContent(block.content);
	const showDate = data.showDate !== false;
	const showCategories = data.showCategories !== false;
	const showTags = data.showTags !== false;
	const showReadTime = data.showReadTime !== false;
	const layout = (data.layout as string) || "inline";

	const mergedClassName = ["wp-block-post-info", className]
		.filter(Boolean)
		.join(" ");

	const isInline = layout === "inline";
	const separator = isInline ? " · " : undefined;

	const hasBoundMeta =
		typeof data.publishedAt === "string" ||
		Array.isArray(data.categories) ||
		Array.isArray(data.tags);

	const items: string[] = [];
	const publishedAt = typeof data.publishedAt === "string" ? data.publishedAt : "";
	const categories = Array.isArray(data.categories)
		? data.categories.filter((item): item is string => typeof item === "string")
		: [];
	const tags = Array.isArray(data.tags)
		? data.tags.filter((item): item is string => typeof item === "string")
		: [];
	const dateFormat = readPostInfoDateFormat(data.dateFormat);
	if (showDate) {
		if (publishedAt) {
			items.push(formatPostInfoDate(publishedAt, dateFormat, typeof data.timeZone === "string" ? data.timeZone : undefined));
		} else if (!hasBoundMeta) {
			items.push("January 15, 2025");
		}
	}
	if (showCategories) {
		if (categories.length > 0) items.push(categories.join(", "));
		else if (!hasBoundMeta) items.push("Technology, Design");
	}
	if (showTags) {
		if (tags.length > 0) items.push(tags.map((tag) => `#${tag}`).join(" "));
		else if (!hasBoundMeta) items.push("#react #nextpress #cms");
	}
	if (showReadTime) items.push("5 min read");

	return (
		<div
			className={mergedClassName || undefined}
			style={{
				display: isInline ? "flex" : "flex",
				flexDirection: isInline ? "row" : "column",
				flexWrap: "wrap",
				gap: isInline ? "0" : "4px",
				color: "var(--npb-text-secondary)",
				fontSize: "0.875rem",
				...style,
			}}
			{...attributes}
		>
			{items.map((item, i) => (
				<React.Fragment key={i}>
					<span className="wp-block-post-info__meta">{item}</span>
					{separator && i < items.length - 1 && <span>{separator}</span>}
				</React.Fragment>
			))}
		</div>
	);
}

/**
 * Post Navigation — bound prev/next from SSR, empty when the blog has no siblings.
 */
export function PostNavigationBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const data = parseStructuredContent(block.content);
	const showLabel = data.showLabel !== false;
	const prevLabel = (data.prevLabel as string) || "Previous Post";
	const nextLabel = (data.nextLabel as string) || "Next Post";
	const isBound = Boolean(data.postId) || "prev" in data || "next" in data;
	const prev = isBound && data.prev && typeof data.prev === "object"
		? (data.prev as Record<string, unknown>)
		: null;
	const next = isBound && data.next && typeof data.next === "object"
		? (data.next as Record<string, unknown>)
		: null;

	const mergedClassName = ["wp-block-post-navigation", className]
		.filter(Boolean)
		.join(" ");

	if (isBound && !prev && !next) {
		return (
			<nav className={mergedClassName || undefined} style={style} {...attributes}>
				<p style={{ margin: 0, color: "var(--npb-text-muted)", fontSize: "0.875rem", textAlign: "center" }}>
					Previous and next posts appear here when more posts in this blog are published.
				</p>
			</nav>
		);
	}

	const showThumbnail = data.showThumbnail === true;
	const prevHref = typeof prev?.slug === "string" ? `/post/${prev.slug}` : "#";
	const nextHref = typeof next?.slug === "string" ? `/post/${next.slug}` : "#";
	const prevTitle = typeof prev?.title === "string" ? prev.title : "Previous Post Title";
	const nextTitle = typeof next?.title === "string" ? next.title : "Next Post Title";
	const prevImage =
		typeof prev?.featuredImage === "string" && isSafePublicMediaUrl(prev.featuredImage)
			? prev.featuredImage
			: "";
	const nextImage =
		typeof next?.featuredImage === "string" && isSafePublicMediaUrl(next.featuredImage)
			? next.featuredImage
			: "";

	return (
		<nav
			className={mergedClassName || undefined}
			style={{
				display: "flex",
				justifyContent: "space-between",
				gap: "16px",
				...style,
			}}
			{...attributes}
		>
			{(!isBound || prev) ? (
				<a
					className="wp-block-post-navigation__link wp-block-post-navigation__link--prev"
					href={prevHref}
					style={{ textDecoration: "none", color: "var(--npb-accent)" }}
				>
					{showLabel && <small style={{ display: "block", color: "var(--npb-text-secondary)" }}>{prevLabel}</small>}
					<span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
						{showThumbnail && prevImage ? (
							<img
								src={prevImage}
								alt=""
								style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4, flexShrink: 0 }}
							/>
						) : null}
						<span>{prevTitle}</span>
					</span>
				</a>
			) : <span />}
			{(!isBound || next) ? (
				<a
					className="wp-block-post-navigation__link wp-block-post-navigation__link--next"
					href={nextHref}
					style={{ textDecoration: "none", color: "var(--npb-accent)", textAlign: "right" }}
				>
					{showLabel && <small style={{ display: "block", color: "var(--npb-text-secondary)" }}>{nextLabel}</small>}
					<span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px" }}>
						<span>{nextTitle}</span>
						{showThumbnail && nextImage ? (
							<img
								src={nextImage}
								alt=""
								style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4, flexShrink: 0 }}
							/>
						) : null}
					</span>
				</a>
			) : <span />}
		</nav>
	);
}

/**
 * Post Table of Contents — SSR placeholder.
 * Shows heading and placeholder list.
 */
export function PostTocBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const data = parseStructuredContent(block.content);
	const title = typeof data.title === "string" ? data.title : "Table of Contents";
	const ordered = data.ordered === true;
	const sticky = data.sticky === true;
	const headings = readBoundHeadings(data.headings);

	const mergedClassName = ["wp-block-post-toc", className]
		.filter(Boolean)
		.join(" ");

	const ListTag = ordered ? "ol" : "ul";
	const stickyStyle = sticky
		? { position: "sticky" as const, top: "1rem", zIndex: 5, alignSelf: "flex-start" as const }
		: {};

	return (
		<nav
			className={mergedClassName || undefined}
			style={{
				border: "1px solid var(--npb-border-default)",
				borderRadius: "var(--npb-radius-input)",
				padding: "1.25rem 1.5rem",
				backgroundColor: "var(--npb-surface-raised)",
				...stickyStyle,
				...style,
			}}
			aria-label="Table of contents"
			{...attributes}
		>
			{title ? <strong className="wp-block-post-toc__title">{title}</strong> : null}
			{headings.length === 0 ? (
				<p className="wp-block-post-toc__empty" style={{ margin: "8px 0 0", color: "var(--npb-text-muted)", fontSize: "0.875rem" }}>
					Headings on this page show up here.
				</p>
			) : (
				<ListTag className="wp-block-post-toc__list" style={{ margin: "8px 0 0", paddingLeft: "20px", color: "var(--npb-text-secondary)", fontSize: "0.875rem", listStyle: ordered ? undefined : "none" }}>
					{headings.map((entry, index) => (
						<li key={`${entry.id}-${index}`} style={{ paddingLeft: `${Math.max(0, (Number(entry.level) || 1) - 1)}rem` }}>
							<a href={`#${entry.id}`}>{entry.text}</a>
						</li>
					))}
				</ListTag>
			)}
		</nav>
	);
}

/** A written post's writing: its blocks in a reading column, inside the blog's look. */
export function PostBodyBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	return (
		<div className={["wp-block-post-body", "np-prose", className].filter(Boolean).join(" ")} style={style} {...attributes}>
			{renderChildBlocks(block.children ?? [])}
		</div>
	);
}

/**
 * Post Progress — SSR placeholder.
 * Static progress bar at 0% (no scroll position in SSR).
 */
export function PostProgressBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const data = parseStructuredContent(block.content);
	const color = (data.color as string) || "var(--npb-accent)";
	const height = (data.height as number) || 4;
	const position = (data.position as string) || "top";
	const backgroundColor = (data.backgroundColor as string) || "transparent";

	const mergedClassName = ["wp-block-post-progress", className]
		.filter(Boolean)
		.join(" ");

	return (
		<div
			className={mergedClassName || undefined}
			role="progressbar"
			aria-valuenow={0}
			aria-valuemin={0}
			aria-valuemax={100}
			style={{
				position: position === "top" ? "sticky" : "fixed",
				top: position === "top" ? 0 : undefined,
				bottom: position === "bottom" ? 0 : undefined,
				left: 0,
				right: 0,
				width: "100%",
				height,
				backgroundColor: backgroundColor === "transparent" ? "var(--npb-border-default)" : backgroundColor,
				zIndex: 50,
				...style,
			}}
			{...attributes}
		>
			<div
				className="wp-block-post-progress__bar"
				style={{
					width: "0%",
					height: "100%",
					backgroundColor: color,
					transition: "width 0.1s linear",
				}}
			/>
		</div>
	);
}