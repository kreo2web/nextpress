import { useId, useState, type FormEvent, type JSX } from "react";
import { Loader2, PenLine } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { newPostBody } from "@shared/blog/compose-blog-post";
import type { Blog } from "@shared/schema-types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useActiveSite } from "@/hooks/useActiveSite";
import { apiRequest } from "@/lib/queryClient";
import { generateId } from "@/lib/utils";
import { BlogSetupDialog } from "./blog-setup-dialog";

type BlogsResponse = { blogs: Blog[] };

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTitle?: string;
}

type Problem = { field: "title" | "form"; message: string };

/** A title (and which blog, when there are several), then the writing editor opens on the new post. */
function NewPostStep({ blogs, firstBlogId, initialTitle, onSetUpBlog, onClose }: { blogs: Blog[]; firstBlogId: string; initialTitle: string; onSetUpBlog: () => void; onClose: () => void }): JSX.Element {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const ids = { title: useId(), blog: useId() };
  const [title, setTitle] = useState(initialTitle);
  const [blogId, setBlogId] = useState(firstBlogId);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!title.trim()) {
      setProblem({ field: "title", message: "Give the post a title." });
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      // A written post is only its body; the blog's look is put around it when it is shown.
      const response = await apiRequest("POST", "/api/posts", { title: title.trim(), blogId, status: "draft", blocks: newPostBody({ newId: generateId }) });
      const post = (await response.json()) as { id: string };
      void queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      onClose();
      setLocation(`/admin/page-builder/post/${post.id}`);
    } catch (error) {
      console.error({ atFunction: "newPost.create", data: { blogId, title, error }, message: "Creating the post failed" });
      setProblem({ field: "form", message: "We couldn't create the post. Check your connection and try again." });
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg flex-col gap-0 p-0" showCloseButton={!saving}>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" aria-busy={saving || undefined}>
          <DialogHeader className="flex-row items-center gap-3 border-b border-npb-divider px-5 py-4 text-left">
            <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-md bg-npb-surface-inset text-npb-text-primary">
              <PenLine className="size-4" />
            </span>
            <DialogTitle className="text-base">New blog post</DialogTitle>
            <DialogDescription className="sr-only">Give the post a title; the writing editor opens on it.</DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto px-5 py-5">
            <div className="grid gap-2">
              <Label htmlFor={ids.title}>Title</Label>
              <Input id={ids.title} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What the post is about" autoFocus disabled={saving} aria-invalid={problem?.field === "title" || undefined} />
              {problem?.field === "title" ? (
                <p role="alert" className="text-sm text-npb-status-error">
                  {problem.message}
                </p>
              ) : null}
            </div>
            {blogs.length > 1 ? (
              <div className="grid gap-2 [&_[data-slot=native-select-wrapper]]:w-full">
                <Label htmlFor={ids.blog}>Blog</Label>
                <NativeSelect id={ids.blog} value={blogId} disabled={saving} onChange={(event) => setBlogId(event.target.value)}>
                  {blogs.map((blog) => (
                    <NativeSelectOption key={blog.id} value={blog.id}>
                      {blog.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            ) : null}
            {problem?.field === "form" ? (
              <p role="alert" className="text-sm text-npb-status-error">
                {problem.message}
              </p>
            ) : null}
          </div>
          <DialogFooter className="border-t border-npb-divider bg-npb-surface-raised px-5 py-3">
            <Button type="button" variant="link" className="mr-auto h-auto px-0" onClick={onSetUpBlog} disabled={saving}>
              Set up a new blog
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {saving ? "Creating…" : "Create post"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LoadingBlogs({ onClose }: { onClose: () => void }): JSX.Element {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">New blog post</DialogTitle>
          <DialogDescription className="sr-only">Checking your blogs.</DialogDescription>
        </DialogHeader>
        <div role="status" aria-label="Checking your blogs" className="grid gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A new blog post, from New, the Posts screen or the editor's blog menu. A site without a blog sets
 * one up first ("Set up your blog"); then a title, and the writing editor opens on the post.
 */
export function CreatePostDialog({ open, onOpenChange, initialTitle = "" }: CreatePostDialogProps): JSX.Element | null {
  const { activeSiteId } = useActiveSite();
  const [settingUp, setSettingUp] = useState(false);
  const [madeBlog, setMadeBlog] = useState<Blog | null>(null);
  const blogsQuery = useQuery<BlogsResponse>({
    queryKey: ["/api/blogs", { status: "any", siteId: activeSiteId }],
    enabled: open && Boolean(activeSiteId),
  });
  if (!open) return null;
  const close = (): void => {
    setSettingUp(false);
    setMadeBlog(null);
    onOpenChange(false);
  };
  const blogs = [...(blogsQuery.data?.blogs ?? []), ...(madeBlog && !blogsQuery.data?.blogs.some((blog) => blog.id === madeBlog.id) ? [madeBlog] : [])];

  if (blogsQuery.isLoading) return <LoadingBlogs onClose={close} />;
  if (settingUp || blogs.length === 0) {
    return (
      <BlogSetupDialog
        onCreated={(blog) => {
          setMadeBlog(blog);
          setSettingUp(false);
        }}
        onClose={blogs.length > 0 ? () => setSettingUp(false) : close}
      />
    );
  }
  return <NewPostStep blogs={blogs} firstBlogId={madeBlog?.id ?? blogs[0].id} initialTitle={initialTitle} onSetUpBlog={() => setSettingUp(true)} onClose={close} />;
}
