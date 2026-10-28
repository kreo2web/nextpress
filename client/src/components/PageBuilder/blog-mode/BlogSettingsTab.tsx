import { useId, useState, type ReactElement } from "react";
import { BLOG_HOME_LAYOUTS, type BlogHomeLayout, type BlogHomeList } from "@shared/blog/blog-home-list";
import type { BlogPostLook } from "@shared/blog/blog-post-look";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { useToast } from "@/hooks/use-toast";
import { pageEditorPath } from "@/lib/admin-content-routes";
import { SettingsChipGroup } from "../settings-chip-group";
import { CommitInput } from "../docs-mode/docs-commit-input";
import { PanelField, SwitchRow } from "../docs-mode/docs-page-tab-parts";
import { useRequiredBlogMode } from "./blog-mode-context";
import { useBlogHome, useRenameBlog, useSaveBlogHomeList } from "./use-blog";

type Section = "post" | "home";

const LOOK_SWITCHES: ReadonlyArray<{ key: keyof BlogPostLook; label: string; hint?: string }> = [
	{ key: "cover", label: "Cover picture", hint: "Under the title." },
	{ key: "date", label: "Date" },
	{ key: "readingTime", label: "Reading time" },
	{ key: "author", label: "Author", hint: "The author's name, picture and bio under the post." },
	{ key: "prevNext", label: "Previous and next" },
	{ key: "comments", label: "Comments", hint: "Each post can still turn its own comments off." },
];

const LIST_SWITCHES: ReadonlyArray<{ key: Exclude<keyof BlogHomeList, "layout">; label: string }> = [
	{ key: "showFeaturedImage", label: "Cover picture" },
	{ key: "showExcerpt", label: "Subtitle" },
	{ key: "showDate", label: "Date" },
	{ key: "showAuthor", label: "Author" },
];

const LAYOUT_LABELS: Record<BlogHomeLayout, string> = { cards: "Cards", grid: "Grid", list: "List" };

const isLayout = (value: string): value is BlogHomeLayout => BLOG_HOME_LAYOUTS.some((layout) => layout === value);

/** How the blog's home lists posts, read from and saved to the post list on its page. */
function BlogHomeSection({ blogId }: { blogId: string }): ReactElement {
	const { toast } = useToast();
	const home = useBlogHome({ blogId });
	const save = useSaveBlogHomeList({ blogId });
	const change = (list: Partial<BlogHomeList>): void => {
		save.mutate(list, {
			onError: (error) => {
				console.error({ atFunction: "blogWriting.saveHomeList", data: { blogId, list, error }, message: "Saving the blog home list failed" });
				toast({ title: "Couldn't change the blog's home", description: "Check your connection and try again.", variant: "destructive" });
			},
		});
	};
	if (home.isLoading) return <p className="text-sm text-npb-text-muted" role="status">Loading the blog's home…</p>;
	if (!home.data) {
		return (
			<p className="text-sm text-npb-text-muted" role="status">
				This blog has no home page of its own yet, so there is no list to set up here.
			</p>
		);
	}
	const { list, address, status, pageId } = home.data;
	return (
		<div className="space-y-4">
			<p className="text-sm text-npb-text-secondary">
				At <span className="font-mono text-xs">{address}</span>
				{status === "publish" ? "" : " (a draft: publish it to show the blog)"}.{" "}
				<a href={pageEditorPath(pageId)} className="font-medium underline underline-offset-2 hover:text-npb-text-primary">
					Open the page
				</a>
			</p>
			<SettingsChipGroup
				label="Layout"
				options={BLOG_HOME_LAYOUTS.map((layout) => ({ value: layout, label: LAYOUT_LABELS[layout] }))}
				value={list.layout}
				onChange={(value) => {
					if (isLayout(value)) change({ layout: value });
				}}
			/>
			<p className="text-sm font-medium text-npb-text-secondary">Each post in the list shows</p>
			{LIST_SWITCHES.map(({ key, label }) => (
				<SwitchRow key={key} label={label} checked={list[key]} disabled={save.isPending} onChange={(on) => change({ [key]: on })} />
			))}
		</div>
	);
}

/**
 * The Blog tab: settings for the whole blog, saved as soon as they change. What a post page shows
 * reaches every post at once, because no post stores a copy of the blog's look.
 */
export function BlogSettingsTab(): ReactElement {
	const { blog, blogLoading, blogFailed, look, saveLook, savingLook } = useRequiredBlogMode();
	const rename = useRenameBlog({ blogId: blog?.id ?? "" });
	const { toast } = useToast();
	const nameId = useId();
	const [open, setOpen] = useState<Section | null>("post");

	if (!blog) {
		return (
			<p className="px-4 py-4 text-sm text-npb-text-muted" role="status">
				{blogFailed ? "Couldn't load the blog. Reload the editor to try again." : blogLoading ? "Loading the blog…" : "This post isn't in a blog."}
			</p>
		);
	}
	return (
		<div>
			<div className="space-y-4 px-4 py-4">
				<p className="npb-settings-hint-muted text-xs">These settings are for the whole blog and are saved as soon as you change them.</p>
				<PanelField label="Name" htmlFor={nameId}>
					<CommitInput
						id={nameId}
						value={blog.name}
						onCommit={(name) => {
							if (!name.trim()) return;
							rename.mutate(name.trim(), {
								onError: (error) => {
									console.error({ atFunction: "blogWriting.renameBlog", data: { blogId: blog.id, error }, message: "Renaming the blog failed" });
									toast({ title: "Couldn't rename the blog", description: "Check your connection and try again.", variant: "destructive" });
								},
							});
						}}
					/>
				</PanelField>
			</div>
			<CollapsibleCard title="Each post shows" open={open === "post"} onOpenChange={(next) => setOpen(next ? "post" : null)}>
				{open === "post" ? (
					<div className="space-y-4">
						{LOOK_SWITCHES.map(({ key, label, hint }) => (
							<SwitchRow key={key} label={label} hint={hint} checked={look[key]} disabled={savingLook} onChange={(on) => void saveLook({ [key]: on })} />
						))}
					</div>
				) : null}
			</CollapsibleCard>
			<CollapsibleCard title="Blog home" open={open === "home"} onOpenChange={(next) => setOpen(next ? "home" : null)}>
				{open === "home" ? <BlogHomeSection blogId={blog.id} /> : null}
			</CollapsibleCard>
		</div>
	);
}
