/**
 * Post List block data model: content shape, post item type, defaults, and pure
 * preview/date helpers. No React here — see `post-list-settings.tsx` for the UI.
 */

export type PostListMore = 'none' | 'show-more' | 'pages';

export type PostListContent = {
  layout?: 'grid' | 'list' | 'cards';
  postsPerPage?: number;
  morePosts?: PostListMore;
  showExcerpt?: boolean;
  showFeaturedImage?: boolean;
  showDate?: boolean;
  showAuthor?: boolean;
  blogId?: string;
  category?: string;
  orderBy?: 'date' | 'title';
  order?: 'asc' | 'desc';
  openIn?: 'overlay' | 'page';
  className?: string;
};

export type PostItem = {
  id: string | number;
  title: string;
  slug: string;
  excerpt?: string;
  featuredImage?: string;
  publishedAt?: string;
  author?: { name: string };
};

export const DEFAULT_CONTENT: PostListContent = {
  layout: 'grid',
  postsPerPage: 6,
  morePosts: 'show-more',
  showExcerpt: true,
  showFeaturedImage: true,
  showDate: true,
  showAuthor: true,
  blogId: '',
  category: '',
  orderBy: 'date',
  order: 'desc',
  openIn: 'overlay',
  className: '',
};

/** Generates placeholder posts for the editor preview. */
export function buildPlaceholderPosts(count: number): PostItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `Post Title ${i + 1}`,
    slug: `post-title-${i + 1}`,
    excerpt:
      'This is a sample excerpt for the post. It gives readers a quick preview of the content.',
    featuredImage: '',
    publishedAt: new Date().toISOString(),
    author: { name: 'Author Name' },
  }));
}

type PostApiRow = {
  id?: string | number;
  title?: string;
  slug?: string;
  excerpt?: string;
  featuredImage?: string;
  featured_image?: string;
  publishedAt?: string;
  published_at?: string;
  createdAt?: string;
  author?: { name?: string };
  authorName?: string;
};

type PostsListResponse = {
  posts?: PostApiRow[];
  total?: number;
  total_pages?: number;
};

/** Map a public or admin posts payload into cards plus page totals. */
export function readPostListResponse(json: PostsListResponse | PostApiRow[]): {
  items: PostItem[];
  total: number;
  totalPages: number;
} {
  const payload: PostsListResponse = Array.isArray(json) ? { posts: json } : json;
  const rows = Array.isArray(payload.posts) ? payload.posts : [];
  const items: PostItem[] = rows.map((row) => ({
    id: row.id ?? "",
    title: row.title ?? "Untitled",
    slug: row.slug ?? "",
    excerpt: row.excerpt ?? "",
    featuredImage: row.featuredImage ?? row.featured_image ?? "",
    publishedAt: row.publishedAt ?? row.published_at ?? row.createdAt ?? "",
    author: row.author
      ? { name: row.author.name ?? "Unknown" }
      : row.authorName
        ? { name: row.authorName }
        : undefined,
  }));
  const total = typeof payload.total === "number" ? payload.total : items.length;
  const totalPages =
    typeof payload.total_pages === "number" && payload.total_pages > 0
      ? payload.total_pages
      : Math.max(1, Math.ceil(total / Math.max(1, items.length)) || 1);
  return { items, total, totalPages };
}

/** Formats an ISO date string to a readable locale date. */
export function formatDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
