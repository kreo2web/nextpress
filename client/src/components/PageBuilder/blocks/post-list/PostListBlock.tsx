import { keepPreviousData, useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { createBlockDefinition } from '../createBlockDefinition';
import {
  LayoutList,
  Calendar,
  User,
  Pencil,
} from 'lucide-react';
import {
  type PostListContent,
  type PostItem,
  DEFAULT_CONTENT,
  buildPlaceholderPosts,
  formatDate,
  readPostListResponse,
} from './post-list-model';
import { PostListSettings } from './post-list-settings';
import { openOverlayHash, PostListOverlay } from './post-list-overlay';
import { appendSiteIdToUrl, readVisitorSiteIdHint } from '@/lib/site-api';
import { useOptionalActiveSite } from '@/hooks/useActiveSite';
import { isSafePublicMediaUrl } from '@shared/bind-post-list';

// ============================================================================
// RENDERER
// ============================================================================

/**
 * Dispatches a custom event to signal the page builder to inline-edit a post.
 * The PageBuilderEditor listens for this event and swaps the canvas content.
 */
function dispatchEditPost(postId: string) {
  window.dispatchEvent(new CustomEvent('np:edit-post', { detail: { postId } }));
}

/**
 * Renders the post list in the chosen layout.
 * In preview mode (isPreview=true) it fetches real posts from the API.
 * In editor mode it fetches real posts when blogId is set (for inline editing),
 * otherwise falls back to placeholder cards.
 */
function PostListRenderer({
  content,
  styles,
  isPreview,
}: {
  content: PostListContent;
  styles?: React.CSSProperties;
  isPreview?: boolean;
}) {
  const cfg = { ...DEFAULT_CONTENT, ...content } as Required<PostListContent>;
  const shouldFetchReal = isPreview || !!cfg.blogId;
  const more = cfg.morePosts ?? 'show-more';
  const [pagesShown, setPagesShown] = useState(1);
  const [listPage, setListPage] = useState(1);
  const perPage =
    more === 'show-more' ? Math.min(50, cfg.postsPerPage * pagesShown) : cfg.postsPerPage;
  const page = more === 'pages' ? listPage : 1;

  // In the editor the list must name the site being edited (drafts are listed per site); visitors
  // are matched by the page's address instead.
  const editorSiteId = useOptionalActiveSite()?.activeSiteId ?? '';
  const siteIdHint = isPreview ? readVisitorSiteIdHint() : editorSiteId;
  const { data, isLoading, isError, error } = useQuery({
    queryKey: [
      'posts',
      isPreview ? 'public' : 'admin',
      siteIdHint,
      cfg.blogId,
      cfg.category,
      perPage,
      page,
      cfg.orderBy,
      cfg.order,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        per_page: String(perPage),
      });
      if (more === 'pages') params.set('page', String(page));
      if (!isPreview) params.set('status', 'any');
      if (cfg.blogId) params.set(isPreview ? 'blogId' : 'blog_id', cfg.blogId);
      if (cfg.category) params.set('category', cfg.category);
      if (cfg.orderBy) {
        const sortField =
          cfg.orderBy === 'date'
            ? 'createdAt'
            : cfg.orderBy === 'title'
              ? 'title'
              : cfg.orderBy;
        params.set('sort', sortField);
      }
      if (cfg.order) params.set('order', cfg.order);

      const res = isPreview
        ? await fetch(
            appendSiteIdToUrl(
              `/api/public/posts?${params.toString()}`,
              readVisitorSiteIdHint(),
            ),
            { credentials: 'same-origin' },
          )
        : await fetch(appendSiteIdToUrl(`/api/posts?${params.toString()}`, editorSiteId), { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to fetch posts (${res.status})`);
      return readPostListResponse(await res.json());
    },
    enabled: shouldFetchReal && (isPreview || !!editorSiteId),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const posts: PostItem[] = data?.items ?? buildPlaceholderPosts(cfg.postsPerPage);
  const total = data?.total ?? posts.length;
  const totalPages = data?.totalPages ?? 1;

  const wrapperClass = ['np-post-list', cfg.className].filter(Boolean).join(' ');

  if (isLoading && !data)
    return (
      <div className={wrapperClass} style={styles}>
        <p className="text-sm text-npb-text-muted py-8 text-center">Loading posts…</p>
      </div>
    );
  if (isError)
    return (
      <div className={wrapperClass} style={styles}>
        <p className="text-sm text-npb-status-error py-8 text-center">
          {error instanceof Error ? error.message : 'Failed to load posts'}
        </p>
      </div>
    );

  if (posts.length === 0) {
    return (
      <div className={wrapperClass} style={styles}>
        <div className="text-center text-npb-text-muted p-8 border-2 border-dashed border-npb-border-strong rounded">
          <LayoutList className="w-10 h-10 mx-auto mb-2" />
          <p>No posts found</p>
        </div>
      </div>
    );
  }

  const layoutMap: Record<string, string> = {
    grid: 'np-post-list__items np-post-list__items--grid',
    list: 'np-post-list__items np-post-list__items--list',
    cards: 'np-post-list__items np-post-list__items--cards',
  };

  return (
    <div className={wrapperClass} style={styles}>
      <div className={layoutMap[cfg.layout] ?? layoutMap.grid}>
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            layout={cfg.layout}
            cfg={cfg}
            isPreview={isPreview}
          />
        ))}
      </div>
      {shouldFetchReal && more === 'show-more' && posts.length < total ? (
        <div className="flex justify-center pt-3">
          <button
            type="button"
            className="h-9 rounded-lg border border-npb-border-default px-4 text-sm"
            onClick={() => setPagesShown((count) => count + 1)}>
            Show more
          </button>
        </div>
      ) : null}
      {shouldFetchReal && more === 'pages' && totalPages > 1 ? (
        <nav className="flex items-center justify-center gap-3 pt-3 text-sm" aria-label="Post list pages">
          <button
            type="button"
            className="h-9 rounded-lg border border-npb-border-default px-3 disabled:opacity-50"
            disabled={listPage <= 1}
            onClick={() => setListPage((current) => Math.max(1, current - 1))}>
            Previous
          </button>
          <span className="text-npb-text-muted">
            Page {listPage} of {totalPages}
          </span>
          <button
            type="button"
            className="h-9 rounded-lg border border-npb-border-default px-3 disabled:opacity-50"
            disabled={listPage >= totalPages}
            onClick={() => setListPage((current) => current + 1)}>
            Next
          </button>
        </nav>
      ) : null}
      {isPreview && cfg.openIn !== 'page' ? <PostListOverlay enabled /> : null}
    </div>
  );
}

// ============================================================================
// POST CARD
// ============================================================================

/** Renders a single post entry adapted to the selected layout. */
function PostCard({
  post,
  layout,
  cfg,
  isPreview,
}: {
  post: PostItem;
  layout: 'grid' | 'list' | 'cards';
  cfg: Required<PostListContent>;
  isPreview?: boolean;
}) {
  const isEditorWithRealPosts = !isPreview && typeof post.id === 'string';

  const handleEditClick = (e: React.MouseEvent) => {
    if (!isEditorWithRealPosts) return;
    e.preventDefault();
    e.stopPropagation();
    dispatchEditPost(String(post.id));
  };

  const useOverlay = Boolean(isPreview && cfg.openIn !== 'page');
  const handleVisitorClick = (e: React.MouseEvent) => {
    if (!useOverlay || !post.slug) return;
    e.preventDefault();
    openOverlayHash(String(post.slug));
  };

  const Wrapper = isPreview ? 'a' : 'div';
  const wrapperProps = isPreview
    ? {
        href: appendSiteIdToUrl(`/post/${post.slug}`, readVisitorSiteIdHint()),
        onClick: handleVisitorClick,
      }
    : {};

  /** Overlay shown in editor mode on real posts — indicates they are clickable for inline editing */
  const editOverlay = isEditorWithRealPosts ? (
    <div
      className="absolute inset-0 bg-black/0 hover:bg-black/5 flex items-center justify-center opacity-0 hover:opacity-100 transition-all cursor-pointer z-10 rounded-lg"
      onClick={handleEditClick}
      title="Click to edit this post">
      <span className="bg-white/90 text-npb-text-secondary text-xs font-medium px-3 py-1.5 rounded-full shadow flex items-center gap-1.5">
        <Pencil className="w-3 h-3" /> Edit Post
      </span>
    </div>
  ) : null;

  const featuredImage = (size: string) =>
    post.featuredImage && isSafePublicMediaUrl(post.featuredImage) ? (
      <div
        className={`${size} flex-shrink-0 rounded bg-npb-surface-inset overflow-hidden flex items-center justify-center`}>
        <img
          src={post.featuredImage}
          alt={post.title}
          className="w-full h-full object-cover"
        />
      </div>
    ) : null;

  if (layout === 'list') {
    return (
      <div className="relative">
        {editOverlay}
        <Wrapper
          {...wrapperProps}
          className="flex items-start gap-4 p-3 rounded-lg border border-npb-border-default hover:border-npb-border-strong transition-colors"
          style={{ textDecoration: 'none', color: 'inherit' }}>
          {cfg.showFeaturedImage && featuredImage('w-24 h-24')}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base leading-tight mb-1 break-words">
              {post.title}
            </h3>
            {cfg.showExcerpt && post.excerpt && (
              <p className="text-sm text-npb-text-muted line-clamp-2">
                {post.excerpt}
              </p>
            )}
            <PostMeta post={post} cfg={cfg} />
          </div>
        </Wrapper>
      </div>
    );
  }

  return (
    <div className="relative">
      {editOverlay}
      <Wrapper
        {...wrapperProps}
        className="flex flex-col rounded-lg border border-npb-border-default overflow-hidden hover:border-npb-border-strong transition-colors"
        style={{ textDecoration: 'none', color: 'inherit' }}>
        {cfg.showFeaturedImage &&
        post.featuredImage &&
        isSafePublicMediaUrl(post.featuredImage) ? (
          <div
            className="w-full bg-npb-surface-inset flex items-center justify-center"
            style={{ height: layout === 'cards' ? 180 : 140 }}>
            <img
              src={post.featuredImage}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : null}
        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-semibold text-base leading-tight mb-1 break-words">
            {post.title}
          </h3>
          {cfg.showExcerpt && post.excerpt && (
            <p className="text-sm text-npb-text-muted line-clamp-3 mb-2">
              {post.excerpt}
            </p>
          )}
          <PostMeta post={post} cfg={cfg} />
        </div>
      </Wrapper>
    </div>
  );
}

/** Renders optional date and author metadata line. */
function PostMeta({
  post,
  cfg,
}: {
  post: PostItem;
  cfg: Required<PostListContent>;
}) {
  const parts: React.ReactNode[] = [];
  if (cfg.showDate && post.publishedAt) {
    parts.push(
      <span key="date" className="inline-flex items-center gap-1">
        <Calendar className="w-3 h-3" />
        {formatDate(post.publishedAt)}
      </span>,
    );
  }
  if (cfg.showAuthor && post.author?.name) {
    parts.push(
      <span key="author" className="inline-flex items-center gap-1">
        <User className="w-3 h-3" />
        {post.author.name}
      </span>,
    );
  }
  if (parts.length === 0) return null;
  return (
    <div className="flex items-center gap-3 text-xs text-npb-text-muted mt-auto pt-2">
      {parts}
    </div>
  );
}

// ============================================================================
// BLOCK DEFINITION
// ============================================================================

const PostListBlock = createBlockDefinition<PostListContent>({
  id: 'post/list',
  label: 'Post List',
  icon: LayoutList,
  description: 'Display a list of posts in grid, list, or card layout',
  category: 'post',
  defaultContent: DEFAULT_CONTENT,
  defaultStyles: { margin: '1em 0' },
  settings: PostListSettings,
  hasSettings: true,
  render: ({ content, styles, isPreview }) => (
    <PostListRenderer content={content} styles={styles} isPreview={isPreview} />
  ),
});

export default PostListBlock;
